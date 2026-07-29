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
| 3 | Send Warmth, emotional weather, memos | Built |
| 4 | Phone-off continuity / nutrient score | Built |
| 5 | AI nudges, PWA | Specced |

Phases 0–4 are verified against a live project: 37 REST checks
(`scripts/verify-phase4.ps1`), 38 more for Phase 1, and 42 browser checks driving
two real clients (`scripts/e2e-handoff.mjs`).

## Quick start

```bash
cd kibo-app
cp .env.local.example .env.local   # then fill in your Supabase URL + anon key
npm install
npm run dev
```

Run every file in `supabase/migrations/` in order in the Supabase SQL editor and
enable anonymous sign-ins first, or every page will show a connection error.
Full steps are in [`kibo-app/README.md`](kibo-app/README.md).
