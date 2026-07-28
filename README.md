# ogis_kibo

KIBO is a shared aquarium for two — an ambient-connection app that treats
silence and low-effort presence as design materials rather than problems to
solve. Fish swim between the participants' screens; the tank keeps going
whether or not anyone says anything.

- **[`Agent.md`](Agent.md)** — design and implementation guide: locked
  decisions, schema, the handoff protocol, per-phase verification checklists,
  and deferred increments.
- **[`kibo-app/`](kibo-app/)** — the Next.js application. See
  [`kibo-app/README.md`](kibo-app/README.md) for Supabase setup and how to run
  it.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Next.js + Supabase setup, env, clients | Built |
| 1 | Schema, RLS, column grants, room join RPCs | Built |
| 2 | Canvas, presence, fish handoff | Built |
| 3 | Send Warmth, emotional weather, memos | Specced |
| 4 | Phone-off continuity / nutrient score | Specced |
| 5 | AI nudges, PWA | Specced |

## Quick start

```bash
cd kibo-app
cp .env.local.example .env.local   # then fill in your Supabase URL + anon key
npm install
npm run dev
```

Run `supabase/migrations/0001_phase1_rooms_and_fish.sql` in the Supabase SQL
editor and enable anonymous sign-ins first, or every page will show a
connection error. Full steps are in
[`kibo-app/README.md`](kibo-app/README.md).
