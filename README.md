# GroundGame

Delegate Mobilization & Call-Tracking Platform — implementation of the Build Specification v1.0.

Tracks delegate outreach across the party hierarchy (**Region → Constituency → Branch → Delegate**)
on two synchronised surfaces:

- **Dashboard** (`apps/web`) — Next.js 14 leadership UI. Upload, assignment, conflict review, analytics.
- **Field Sheets** — one Google Sheet per constituency; callers tick outcome checkboxes.
- **API + Sync Worker** (`apps/api`) — NestJS. Business logic, RBAC + scope, Google Sheets sync every 15 min.
- **Database** (`supabase/`) — Postgres (RLS) — the analytical source of truth.

## Repo layout

```
apps/
  web/        Next.js 14 dashboard (App Router, TS, Tailwind tokens, TanStack Query, Recharts)
  api/        NestJS API + BullMQ sync worker
supabase/
  migrations/ SQL schema + RLS policies (Section 6)
```

## Quick start (dashboard)

```bash
npm install
npm run dev:web      # http://localhost:3000
```

The dashboard runs against a typed mock data layer (`apps/web/lib/mock`) shaped to the API contract
(Section 12), so every screen is viewable before the backend is wired. Set
`NEXT_PUBLIC_API_BASE_URL` to point screens at the live NestJS API.

## API

```bash
npm run dev:api      # NestJS on :4000 (needs Supabase + Redis env, see apps/api/.env.example)
```

## Loading the real delegate data into the deployed app (Supabase)

The real rosters (`apps/web/lib/delegates.local.json`) are **gitignored** — PII never goes
to GitHub. To make real data show on the **deployed** site, load it into Supabase (the app
then reads it server-side; the browser never sees the service key):

1. **Create a Supabase project** and open the SQL editor.
2. **Run the migrations** in order:
   - `supabase/migrations/0001_init.sql` (schema + RLS)
   - `supabase/migrations/0002_seed_hierarchy.sql` (16 regions, 233 constituencies)
3. **Seed the rosters** from your machine (regenerate the local file first if needed with
   `python scripts/extract_delegates.py`):
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
   node scripts/seed_supabase.mjs
   ```
   This upserts the regions, constituencies, and ~2,800 delegates straight into your DB.
4. **Set the same two vars in Vercel** → Project → Settings → Environment Variables
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — *not* `NEXT_PUBLIC_*`), then redeploy.

The app reads rosters from Supabase when those vars are present, and falls back to the local
file otherwise. Call metrics / coverage / projections remain simulated until field calls begin.

## Environment

See `apps/web/.env.example` and `apps/api/.env.example`. Secrets (service-account key,
service-role key) are backend-only and must never reach the frontend or Git (Section 14).

## Build phases (Section 17)

- **Phase 0** Foundations — repos, schema/RLS, auth, service account + Shared Drive. _(schema in `supabase/`)_
- **Phase 1** Core dashboard + data — upload, hierarchy/delegate APIs, read-only screens, one-way Sheet read.
- **Phase 2** Field loop — Sheet provisioning, two-way sync, conflicts + review queue.
- **Phase 3** Intelligence — analytics, projection, caller performance, exports.
- **Phase 4** Hardening — audit, opposed-label gating, retention, daily brief.

Status: dashboard UI + data contract + DB schema + API skeleton in place. Sync worker and live
data wiring are the next milestones.
