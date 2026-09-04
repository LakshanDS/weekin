# Plan — WeekIn (Weekly Report Generator & Team Dashboard)

Technical assignment for Sisenco Digital (Pvt) Ltd — Full-stack Developer position.
**Deadline: 10 Sep 2026.** Live coding round follows: must be able to explain & extend everything submitted.

---

## ✅ DONE — application & code

### Stack (final)
| Layer | Choice |
|---|---|
| Frontend + Backend | Nuxt 4 full-stack — Nitro server routes as the REST API (Node.js) |
| Database | PostgreSQL 18 (native Windows install, no Docker) + Drizzle ORM + postgres.js |
| Auth | JWT (jose) in httpOnly cookie + bcryptjs, roles MEMBER/MANAGER |
| Validation | zod schemas in `shared/` — one source for API (`readValidatedBody`) + client forms |
| Charts | Chart.js + vue-chartjs |
| Tests | Vitest — 8 integration tests (review cycle + RBAC), all passing |
| Styling | Tailwind CSS 4 |

### Features
- [x] Auth & roles: register/login/logout/me, JWT cookie session, signup always MEMBER, admin promotes via Members page
- [x] Weekly reports, fixed structure: week range, project, task table (priority, planned vs actual %, status, time, deliverable), next week, blockers/achievements with key flag, hours by type, notes
- [x] Review workflow: DRAFT → SUBMITTED → NEEDS_CORRECTION → APPROVED; comment required on send-back, optional on approve
- [x] Version history: draft edits in place; every submit freezes a version; comments tied to exact version; past versions viewable in UI
- [x] RBAC: members see/edit own only (404, no existence leak); managers see all, never rewrite content
- [x] Manager dashboard: compliance (on-time/late/pending), needs-correction, open blockers, 4 charts, activity feed
- [x] Team week view (bonus): key blocker + key achievement side by side
- [x] Projects CRUD page · Members page (roles, invite, remove) · member profile with stats · review queue
- [x] Custom confirmation dialog on every delete action
- [x] AI assistant (bonus): manager chat widget → grounded report context → **Gemini 3.5 Flash Lite** (OpenAI-compatible, any provider via env); offline summary mode without key
- [x] 13 pages (requirement ≥7)

### Data & quality
- [x] Schema: users, projects, project_members, reports, report_versions, review_comments
- [x] Seed: 1 manager + 5 members, 4 projects, 6 weeks, 28 reports / 33 versions / 20 comments, mixed statuses (`bun run db:seed`, idempotent)
- [x] Tests: `tests/review-cycle.test.ts` — full correction cycle + every RBAC rule, 8/8 green, self-cleaning
- [x] Validation (zod, 422 field errors), pagination + filters on lists
- [x] ER diagram: `docs/er-diagram.png` (+ regenerable `.mmd` source)
- [x] README: full setup, architecture, API table, compliance map

### Design & deploy prep
- [x] `designs/`: WeekIn brand — logo SVGs from Fredoka Bold 700 (primary/white/mono/mark), palette ink `#242424` + coral `#FF5757` + white, `tokens.json`, design docs
- [x] Cloudflare compatibility: `build:cf` + `wrangler.jsonc` (cloudflare_module, nodejs_compat), per-request DB clients (Workers I/O rule), verified locally under workerd — 16/16 probes green incl. AI + dashboard
- [x] GitHub Actions CI/CD: test job (Postgres service container) + deploy job (wrangler) — dormant until repo is pushed

---

## ⬜ REMAINING before final submission

1. **WeekIn rebrand of the app UI** (next task)
   - Name WeekLog → WeekIn everywhere (nav, auth pages, titles, AI widget header)
   - Use `designs/logo` assets in nav/auth; apply ink/coral/white tokens + Fredoka display headings via `@theme` in `app/assets/css/main.css`
   - Keep semantic status colors distinct from coral (see designs/README rules)

2. **GitHub push** (needs Lakshan: create repo / provide URL)
   - Push `main` → CI runs tests automatically
   - Repo secrets for deploy job: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

3. **Cloudflare deploy** (bonus; needs Lakshan: Cloudflare + Neon accounts)
   - Neon connection string → `wrangler secret put NUXT_DATABASE_URL` (+ `NUXT_JWT_SECRET`, `NUXT_AI_API_KEY`)
   - `wrangler login` → deploy (or let CI deploy on push); verify live app; add URL to submission

4. **Presentation (Google Slides)**
   - Architecture · DB design (ER) · key frontend components · API + RBAC · review workflow + versioning · AI approach (prompt design + privacy) · challenges (Workers I/O rule, versioning model, Nuxt auto-import pitfalls) · future improvements

5. **Demo video** — script + shot list to be written
   - Face on camera (OBS); both roles, full correction cycle, dashboard, AI chat
   - Reseed before recording (`bun run db:seed`); don't run tests after seeding (test report leftover)

6. **Submission logistics** (hard — missing/locked links = disqualification)
   - One Drive folder: Slides + ER image + video, sharing "Anyone with the link"
   - GitHub repo link + Drive link in email to careers@sisencodigital.com
   - Final QA: fresh-clone setup test per README, check links from incognito

---

## Reference — data model

```
server/database/       schema.ts (drizzle), seed.ts
drizzle/               generated SQL migrations
```

```
users(id, name, email unique, passwordHash, role[MEMBER|MANAGER], createdAt)
projects(id, name unique, description, createdAt)
project_members(projectId, userId, unique pair)
reports(id, userId → users, projectId → projects (SET NULL), weekStart, weekEnd,
        status[DRAFT|SUBMITTED|NEEDS_CORRECTION|APPROVED], submittedAt, reviewedAt, createdAt, updatedAt)
        -- unique(userId, weekStart): one report per member per week
report_versions(id, reportId → reports, versionNo,
        tasks Jsonb [{name, priority, plannedPct, actualPct, status, timePlannedH, timeSpentH, deliverable}],
        nextWeekTasks Jsonb, blockers Jsonb [{text, isKey}], achievements Jsonb [{text, isKey}],
        hoursByType Jsonb, notes,
        submittedAt (null = draft-in-progress, invisible to managers), createdAt)
        -- draft edits update the latest unsubmitted row; every submit freezes it
review_comments(id, reportId → reports, versionId → report_versions, managerId → users,
        action[REQUEST_CHANGES|APPROVE], comment, createdAt)
-- latest version derived (max versionNo), not denormalized
```

## Reference — API surface

- `POST /api/auth/register|login|logout` · `GET /api/auth/me`
- `GET/POST /api/reports` · `GET/PUT/DELETE /api/reports/:id` · `POST …/submit|approve 🛡|request-changes 🛡` · `GET …/versions`
- `GET /api/dashboard` 🛡 · `GET /api/team/week` 🛡 · `GET /api/team/:id` 🛡
- `CRUD /api/projects` (write 🛡) · `GET/POST /api/users` 🛡 · `PUT/DELETE /api/users/:id` 🛡
- `POST /api/ai/chat` 🛡
🛡 manager-only; every report route re-checks ownership.

## Setup log
- Project home: `F:\Projects\SF-Assignment` (repo root)
- PostgreSQL 18 native (service `postgresql-x64-18`); superuser password reset (recorded locally in user AGENTS.md, not in this repo); app role `weekly_app` / `weekly_app_dev`, DB `weekly_reports`
- No Docker on this machine; Neon reserved for the Cloudflare deploy
- Dev: `bun run dev` · Workers preview: `bun run dev:cf` (:8787) · Tests: `bun run test` (needs dev server running)
- Port 3000 sometimes occupied by another app — Nuxt auto-falls back; confirm port from the dev log
