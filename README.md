# WeekLog — Weekly Report Generator & Team Dashboard

A full-stack internal tool where team members submit structured weekly reports and managers review them, send them back for correction, and analyse team activity on a data dashboard.

Built for the Sisenco Digital full-stack technical assignment.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Nuxt 4** (Vue 3 + Vite) — full-stack; Nitro server routes are the REST API (Node.js) |
| Database | **PostgreSQL** with **Drizzle ORM** (plain SQL migrations) |
| Auth | JWT (httpOnly cookie, `jose`) + bcrypt password hashing, role-based access (`MEMBER` / `MANAGER`) |
| Validation | **zod** schemas shared between the API (`readValidatedBody`) and client forms |
| Charts | Chart.js + vue-chartjs |
| Tests | Vitest — integration tests for the review cycle and role-based access control |
| Styling | Tailwind CSS 4 |

### Architecture

```
app/                      Frontend (Vue pages, components, composables)
  pages/                  login, register, reports, review, dashboard, team, members, projects
  components/             UI + report + dashboard + AI chat widget
  composables/useAuth.ts  session state (JWT cookie resolved via /api/auth/me)
  middleware/auth.global  route guard: session check + role meta
server/                   Backend (Nitro, Node.js)
  api/                    REST endpoints (controllers)
  utils/                  auth (JWT/bcrypt/RBAC), reports (workflow + versioning), dashboard (aggregations), ai
  database/               Drizzle schema + seed
  middleware/auth.ts      attaches the session user to every /api request
shared/                   Code shared by frontend and backend
  schemas/                zod validation schemas (single source of truth)
  types/                  report content types (jsonb shapes)
  utils/                  week helpers
drizzle/                  Generated SQL migrations
tests/                    Vitest integration tests (RBAC + review cycle)
```

### Domain model

- **users** — `MEMBER` or `MANAGER`
- **projects** / **project_members** — work categories and assignments
- **reports** — one per user per week; status flows `DRAFT → SUBMITTED → NEEDS_CORRECTION → APPROVED`
- **report_versions** — full content snapshot per version. Draft edits update the unsubmitted version in place; **every submit freezes the version**, so each correction cycle builds visible history
- **review_comments** — manager comments tied to the exact version they were made against (supports Approve notes and Request Changes)

See `docs/er-diagram.png` (source: `docs/er-diagram.mmd`).

## Setup instructions

### 1. Prerequisites

- [Bun](https://bun.sh) (or Node 20+ with npm — commands below use bun)
- PostgreSQL 14+ running locally (or a hosted Postgres such as Neon)

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Then set in `.env`:

| Variable | Purpose |
|---|---|
| `NUXT_DATABASE_URL` | Postgres connection string for the app |
| `NUXT_JWT_SECRET` | Long random string used to sign session tokens |
| `NUXT_AI_API_KEY` | Optional — API key for the AI assistant (see below) |
| `NUXT_AI_BASE_URL` / `NUXT_AI_MODEL` | Optional — any OpenAI-compatible endpoint/model |

### 4. Create the database

Create a role and database (adjust the password to match your connection string):

```sql
CREATE ROLE weekly_app LOGIN PASSWORD 'yourpassword';
CREATE DATABASE weekly_reports OWNER weekly_app;
```

### 5. Run migrations and seed

```bash
bun run db:migrate   # apply SQL migrations from drizzle/
bun run db:seed      # demo data: 1 manager + 5 members + 6 weeks of reports in mixed statuses
```

### 6. Run the app (frontend + backend together)

```bash
bun run dev
```

Open http://localhost:3000 — Nuxt serves both the Vue app and the REST API.

### 7. Run tests

Tests hit a running dev server with the seeded database:

```bash
bun run dev          # in one terminal (if not already running)
bun run test         # in another — review cycle + RBAC integration tests
```

### 8. Production build

```bash
bun run build
bun run preview
```

## Demo accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Manager | `manager@demo.io` | `password123` |
| Member | `alice@demo.io` (also bob, chatura, dilini, ethan @demo.io) | `password123` |

The seed generates six weeks of reports per member across every workflow status, including full correction cycles (v1 → manager comment → v2 → approved), late submissions, drafts, and not-started weeks, so the dashboard is meaningful immediately.

## Feature tour

**Team member**: register → My Reports → New report (task table with priority/planned-vs-actual %/time/deliverable, next-week plan, blockers and achievements with a "key" flag, hours by type, notes) → Save draft → Submit for review. When a report comes back, the manager's comment appears on the report; edit and resubmit — every submitted version stays in the history.

**Manager**: Dashboard (weekly compliance, open blockers, needs-correction count, task trend, status by member, hours by project and task type, activity feed) → Review queue → open a submitted report → Approve, or Request changes with a comment tied to the version under review → the member can view past versions side by side with the current one. Also: Team week view (all members' key blockers/achievements side by side), Members (roles, invites, removal), Projects (CRUD), and the AI assistant chat.

## AI assistant

Manager-only chat widget (`POST /api/ai/chat`). The endpoint injects a compact, grounded snapshot of the team's submitted reports (window of recent weeks) into the system prompt and answers strictly from that data.

- **Provider**: any OpenAI-compatible chat completions API — configure `NUXT_AI_API_KEY`, `NUXT_AI_BASE_URL`, `NUXT_AI_MODEL`. Nothing is hard-coded to one vendor.
- **Privacy**: report data stays in your database; only the compact context window of the current question is sent to the configured LLM endpoint, and only manager-authenticated requests can trigger it.
- **Offline mode**: with no API key configured the widget still answers with a deterministic data summary, clearly labelled as offline.
- **Prompt design**: system prompt fixes the role ("answer only from the report data, cite member names and weeks, be concise, admit gaps"), the data snapshot is appended per request, and only the last six conversation turns are replayed.

## API overview

All routes under `/api`, JSON, cookie-authenticated. List endpoints support pagination (`page`, `pageSize`) and filtering.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Reports | `GET/POST /reports`, `GET/PUT/DELETE /reports/:id`, `POST /reports/:id/submit`, `POST /reports/:id/approve` 🛡, `POST /reports/:id/request-changes` 🛡, `GET /reports/:id/versions` |
| Dashboard | `GET /dashboard` 🛡 |
| Team | `GET /team/week` 🛡, `GET /team/:id` 🛡 |
| Projects | `GET /projects`, `POST /projects` 🛡, `PUT/DELETE /projects/:id` 🛡 |
| Users | `GET/POST /users` 🛡, `PUT/DELETE /users/:id` 🛡 |
| AI | `POST /ai/chat` 🛡 |

🛡 manager-only. Every report route re-checks ownership: members can never read or write another member's report (404, no existence leak), managers can review but never rewrite report content.

## Deploying to Cloudflare (Workers)

The Nuxt server layer targets Cloudflare Workers via Nitro's `cloudflare_module` preset (configured in `wrangler.jsonc`, `nodejs_compat` enabled). The database client is Workers-compatible: `prepare: false` plus per-request clients, since Workers forbids I/O objects crossing request boundaries. Verified locally under `wrangler dev` (workerd) against a live PostgreSQL.

```bash
bun run build:cf       # NITRO_PRESET=cloudflare_module nuxt build
bun run dev:cf         # local preview on the Workers runtime (syncs .env -> .dev.vars)
bunx wrangler deploy   # after `wrangler login`
```

Continuous deployment runs through GitHub Actions (`.github/workflows/deploy.yml`): every push runs the integration tests against a real Postgres service container, and pushes to `main` build with the Workers preset and deploy via `wrangler`. Add two repository secrets to enable the deploy job: `CLOUDFLARE_API_TOKEN` (Workers deploy permission) and `CLOUDFLARE_ACCOUNT_ID`.

On Cloudflare, set secrets instead of `.env`:

```bash
bunx wrangler secret put NUXT_DATABASE_URL   # e.g. a Neon pooled connection string
bunx wrangler secret put NUXT_JWT_SECRET
bunx wrangler secret put NUXT_AI_API_KEY
```

For production traffic, add a [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) binding in front of the same Postgres — the app needs no code change, only the connection string it reads.

## Assignment compliance map

- Auth & roles, fixed report structure, review/correction workflow with version history — Sections 1–3
- Manager dashboard with filters, metrics, charts, activity feed; side-by-side team week view — Sections 4, 6 (incl. bonus)
- Projects CRUD page, user management page, member profile, review queue — Sections 5, 7
- AI chat assistant (bonus) — Section 8
- RBAC integration tests — `tests/review-cycle.test.ts`
