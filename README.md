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
