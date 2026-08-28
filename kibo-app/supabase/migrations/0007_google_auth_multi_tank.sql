-- KIBO - Phase 7 / Milestone 1: Google OAuth Profiles, Multi-Tank Schema, and Capacity Scaling.
--
-- Safe to re-run.

-- ---------------------------------------------------------------- profiles ---
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  fish_points integer not null default 0 check (fish_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (email);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

grant select on public.profiles to authenticated, anon;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;
grant insert on public.profiles to authenticated;

drop policy if exists "authenticated read profiles" on public.profiles;
create policy "authenticated read profiles" on public.profiles
  for select using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert with check (id = auth.uid());

-- Maintain updated_at on profiles
create or replace function public.touch_profiles_updated_at() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_profiles_updated_at();

-- Auto-provision profile from auth.users (Google OAuth metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = pg_catalog, public as $$
declare
  user_name text;
  user_avatar text;
begin
  user_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Aquanaut'
  );
  user_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    null
  );

  insert into public.profiles (id, email, display_name, avatar_url, fish_points)
  values (new.id, new.email, user_name, user_avatar, 0)
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------- rooms update ---
alter table public.rooms add column if not exists name text not null default 'Shared Tank';
alter table public.rooms add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.rooms add column if not exists active_away_count integer not null default 0 check (active_away_count >= 0);

grant update (tank_mood, name) on public.rooms to authenticated;

drop policy if exists "members set mood" on public.rooms;
drop policy if exists "members update room" on public.rooms;
create policy "members update room" on public.rooms
  for update using (public.is_member(id)) with check (public.is_member(id));

-- -------------------------------------------------------------- fish update ---
alter table public.fish add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.fish add column if not exists fin_style text not null default 'classic';

grant update (holder, direction, y_frac, speed_px_s, color, fin_style) on public.fish to authenticated;

create index if not exists fish_room_owner_idx on public.fish (room_id, owner_id);

-- ----------------------------------------------------------------- vouchers ---
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  title text not null,
  description text not null,
  points_cost integer not null check (points_cost > 0),
  discount_code text not null,
  category text not null check (category in ('coffee', 'dining', 'wellness', 'culture', 'retail', 'general')),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  points_spent integer not null check (points_spent > 0),
  redeemed_at timestamptz not null default now()
);

create index if not exists voucher_redemptions_user_idx on public.voucher_redemptions (user_id, redeemed_at desc);

alter table public.vouchers enable row level security;
alter table public.voucher_redemptions enable row level security;

revoke all on public.vouchers, public.voucher_redemptions from anon, authenticated;
grant select on public.vouchers to authenticated, anon;
grant select on public.voucher_redemptions to authenticated;
grant insert on public.voucher_redemptions to authenticated;

drop policy if exists "anyone read active vouchers" on public.vouchers;
create policy "anyone read active vouchers" on public.vouchers
  for select using (is_active = true);

drop policy if exists "users read own redemptions" on public.voucher_redemptions;
create policy "users read own redemptions" on public.voucher_redemptions
  for select using (user_id = auth.uid());

drop policy if exists "users insert own redemptions" on public.voucher_redemptions;
create policy "users insert own redemptions" on public.voucher_redemptions
  for insert with check (user_id = auth.uid());

-- RPC to safely redeem vouchers with point deduction
create or replace function public.redeem_voucher(target_voucher_id uuid)
returns table (status text, redemption_id uuid, remaining_points integer)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  caller uuid := auth.uid();
  v_cost integer;
  v_active boolean;
  curr_points integer;
  new_redemption_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select points_cost, is_active into v_cost, v_active
  from public.vouchers where id = target_voucher_id;

  if v_cost is null or not v_active then
    return query select 'voucher_not_found'::text, null::uuid, null::integer;
    return;
  end if;

  select fish_points into curr_points
  from public.profiles where id = caller
  for update;

  if curr_points is null or curr_points < v_cost then
    return query select 'insufficient_points'::text, null::uuid, coalesce(curr_points, 0);
    return;
  end if;

  update public.profiles
  set fish_points = fish_points - v_cost, updated_at = now()
  where id = caller;

  insert into public.voucher_redemptions (user_id, voucher_id, points_spent)
  values (caller, target_voucher_id, v_cost)
  returning id into new_redemption_id;

  return query select 'ok'::text, new_redemption_id, curr_points - v_cost;
end;
$$;

revoke execute on function public.redeem_voucher(uuid) from public, anon;
grant execute on function public.redeem_voucher(uuid) to authenticated;

-- Seed default partner vouchers if none exist
insert into public.vouchers (partner_name, title, description, points_cost, discount_code, category, image_url)
select * from (values
  ('Blue Bottle Coffee', 'Artisanal Drip Coffee', 'Complimentary pour-over of single-origin blend at any location.', 120, 'KIBO-BBC-120', 'coffee', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80'),
  ('Ten Thousand Coffee', 'Signature Einspänner 20% Off', '20% off our signature velvet cream espresso beverage.', 80, 'KIBO-TTC-20OFF', 'coffee', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80'),
  ('Matcha Cafe Maiko', 'Ceremonial Matcha Parfait', 'Free upgrade to Gold Leaf Uji Matcha soft-serve parfait.', 150, 'KIBO-MAIKO-PARFAIT', 'dining', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400&q=80'),
  ('Kinfolk Bookstore & Teahouse', '$10 Off Books & Loose Leaves', '$10 voucher valid on all indie books and whole leaf teas.', 200, 'KIBO-KINFOLK-10', 'culture', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80'),
  ('Sunset Sound Bath & Sauna', 'Guided Relaxation Session', '50% discount on a 60-minute ambient sound meditation pass.', 300, 'KIBO-SOUND-50', 'wellness', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&q=80'),
  ('Float Sanctuary', 'Sensory Deprivation Float (60m)', 'Complimentary warm magnesium flotation tank session.', 500, 'KIBO-FLOAT-FREE', 'wellness', 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&q=80')
) as v(partner_name, title, description, points_cost, discount_code, category, image_url)
where not exists (select 1 from public.vouchers);

-- ------------------------------------------------------------ time capsules ---
create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  memory_text text not null check (char_length(memory_text) between 1 and 1000),
  media_url text,
  unlock_at timestamptz not null,
  unlocked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists time_capsules_room_unlock_idx on public.time_capsules (room_id, unlock_at);

alter table public.time_capsules enable row level security;

revoke all on public.time_capsules from anon, authenticated;
grant select, insert, update on public.time_capsules to authenticated;

drop policy if exists "members read time capsules" on public.time_capsules;
create policy "members read time capsules" on public.time_capsules
  for select using (public.is_member(room_id));

drop policy if exists "members create time capsules" on public.time_capsules;
create policy "members create time capsules" on public.time_capsules
  for insert with check (public.is_member(room_id) and created_by = auth.uid());

drop policy if exists "members update time capsules" on public.time_capsules;
create policy "members update time capsules" on public.time_capsules
  for update using (public.is_member(room_id)) with check (public.is_member(room_id));

-- ------------------------------------------------- lifecycle RPCs updated ---

-- Drop existing create_room overloads
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_room'
  loop
    execute format('drop function %s', f.sig);
  end loop;
end
$$;

create function public.create_room(room_name text default 'Shared Tank')
returns table (room_id uuid, room_code text)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  caller uuid := auth.uid();
  new_code text;
  new_id uuid;
  tries int := 0;
  color_options text[] := array['#F5B041', '#7FB3D5', '#E74C3C', '#48C9B0', '#AF7AC5', '#F39C12', '#5DADE2', '#58D68D'];
  fin_options text[] := array['classic', 'fan', 'ribbon', 'dragon', 'spiky'];
  chosen_color text;
  chosen_fin text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  loop
    new_code := (
      select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
               1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from public.rooms where code = new_code);
    tries := tries + 1;
    if tries > 10 then raise exception 'code_generation_failed'; end if;
  end loop;

  insert into public.rooms (code, name, created_by)
  values (new_code, coalesce(nullif(trim(room_name), ''), 'Shared Tank'), caller)
  returning id into new_id;

  insert into public.room_participants (room_id, user_id)
  values (new_id, caller);

  chosen_color := color_options[1 + floor(random() * array_length(color_options, 1))::int];
  chosen_fin := fin_options[1 + floor(random() * array_length(fin_options, 1))::int];

  -- Provision creator's fish
  insert into public.fish (room_id, holder, owner_id, y_frac, speed_px_s, direction, color, fin_style)
  values (new_id, caller, caller, 0.42, 52, 1, chosen_color, chosen_fin);

  return query select new_id, new_code;
end;
$$;

revoke execute on function public.create_room(text) from public, anon;
grant execute on function public.create_room(text) to authenticated;

-- Drop existing join_room overloads
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'join_room'
  loop
    execute format('drop function %s', f.sig);
  end loop;
end
$$;

create function public.join_room(room_code text)
returns table (status text, joined_room uuid)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  caller uuid := auth.uid();
  target uuid;
  occupants int;
  recent_failures int;
  color_options text[] := array['#F5B041', '#7FB3D5', '#E74C3C', '#48C9B0', '#AF7AC5', '#F39C12', '#5DADE2', '#58D68D'];
  fin_options text[] := array['classic', 'fan', 'ribbon', 'dragon', 'spiky'];
  chosen_color text;
  chosen_fin text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select count(*) into recent_failures
  from public.join_attempts ja
  where ja.user_id = caller
    and ja.succeeded = false
    and ja.attempted_at > now() - interval '15 minutes';

  if recent_failures >= 10 then
    return query select 'too_many_attempts'::text, null::uuid;
    return;
  end if;

  select r.id into target from public.rooms r where r.code = upper(trim(room_code));

  if target is null then
    insert into public.join_attempts (user_id, succeeded) values (caller, false);
    return query select 'room_not_found'::text, null::uuid;
    return;
  end if;

  -- Idempotent rejoin: not a new attempt, ensure fish exists
  if exists (
    select 1 from public.room_participants rp
    where rp.room_id = target and rp.user_id = caller
  ) then
    update public.room_participants rp set last_seen_at = now()
    where rp.room_id = target and rp.user_id = caller;

    if not exists (
      select 1 from public.fish f where f.room_id = target and f.owner_id = caller
    ) then
      chosen_color := color_options[1 + floor(random() * array_length(color_options, 1))::int];
      chosen_fin := fin_options[1 + floor(random() * array_length(fin_options, 1))::int];
      insert into public.fish (room_id, holder, owner_id, y_frac, speed_px_s, direction, color, fin_style)
      values (target, caller, caller, 0.2 + (random() * 0.6)::real, 35 + (random() * 25)::real, case when random() > 0.5 then 1 else -1 end, chosen_color, chosen_fin);
    end if;

    return query select 'ok'::text, target;
    return;
  end if;

  -- Free slot for stale participants (> 14 days)
  delete from public.room_participants rp
  where rp.room_id = target
    and rp.last_seen_at < now() - interval '14 days';

  select count(*) into occupants
  from public.room_participants rp where rp.room_id = target;

  -- Capacity expanded to 5 members per room
  if occupants >= 5 then
    insert into public.join_attempts (user_id, succeeded) values (caller, false);
    return query select 'room_full'::text, null::uuid;
    return;
  end if;

  insert into public.room_participants (room_id, user_id) values (target, caller)
  on conflict (room_id, user_id) do nothing;

  -- Dynamically provision personalized fish for the joining member
  if not exists (
    select 1 from public.fish f where f.room_id = target and f.owner_id = caller
  ) then
    chosen_color := color_options[1 + floor(random() * array_length(color_options, 1))::int];
    chosen_fin := fin_options[1 + floor(random() * array_length(fin_options, 1))::int];
    insert into public.fish (room_id, holder, owner_id, y_frac, speed_px_s, direction, color, fin_style)
    values (target, caller, caller, 0.2 + (random() * 0.6)::real, 35 + (random() * 25)::real, case when random() > 0.5 then 1 else -1 end, chosen_color, chosen_fin);
  end if;

  insert into public.join_attempts (user_id, succeeded) values (caller, true);
  update public.rooms r set last_interaction_at = now() where r.id = target;
  return query select 'ok'::text, target;
end;
$$;

revoke execute on function public.join_room(text) from public, anon;
grant execute on function public.join_room(text) to authenticated;

-- ---------------------------------------------------------------- realtime ---
do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.time_capsules;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.vouchers;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.voucher_redemptions;
  exception when duplicate_object then null;
  end;
end
$$;

-- ----------------------------------------------------------- schema version ---
create or replace function public.kibo_schema_version() returns text
language sql immutable set search_path = pg_catalog as $$
  select '0007'::text;
$$;
grant execute on function public.kibo_schema_version() to authenticated, anon;
