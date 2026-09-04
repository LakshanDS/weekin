# Plan — Weekly Report Generator & Team Dashboard

Technical assignment for Sisenco Digital (Pvt) Ltd — Full-stack Developer position.
**Deadline: 10 Sep 2026.** Live coding round follows: must be able to explain & extend everything submitted.

## Stack decision

| Layer | Choice | Why |
|---|---|---|
| Frontend | Nuxt 4 (Vue 3, Vite) | Vue is on their preferred list; one framework to defend live |
| Backend | Nitro server routes (Node.js) | Full-stack Nuxt = one deploy, one setup; `server/` structured as controllers/services/middleware |
| DB | PostgreSQL + Prisma | Industry standard; Neon free tier for the bonus deploy |
| Auth | JWT in httpOnly cookie + bcrypt | No magic deps; every line explainable live |
| Charts | Chart.js + vue-chartjs | Recharts is React-only |
| Tests | Vitest (RBAC integration tests) | Explicitly "strongly recommended" |
| AI (bonus) | Chat widget → `/api/ai/chat` → LLM API with report context | Viewed favorably |

## Requirement checklist (from the assignment PDF)

### 1. Auth & roles
- [ ] Register / login / logout, hashed passwords, JWT session cookie
- [ ] Roles: `MEMBER` (own reports only) / `MANAGER` (all reports, review actions)
- [ ] Role assignment: at signup user picks Member; manager accounts via seed / admin panel

### 2. Personal weekly report (fixed structure for everyone)
- [ ] Fields: week range · project tag · task table (name, priority, planned% vs actual%, status, time planned vs spent, deliverable) · next week plan · blockers (flag key) · achievements (flag key) · hours by type (optional) · notes/links
- [ ] Create (draft) · edit while Draft/Needs Correction · submit · history list with status

### 3. Review & correction workflow (CORE)
- [ ] Status flow: `DRAFT → SUBMITTED → NEEDS_CORRECTION → APPROVED`
- [ ] Manager: Approve **or** Request Changes + one general comment
- [ ] Member sees comment on their report page, edits, resubmits → back to SUBMITTED
- [ ] Members: see/edit own only. Managers: see all, edit only status/comment — never report content
- [ ] **Version history**: snapshot content on every submit; manager views past versions; comments tied to the version they were made against
- [ ] Bonus: full comment history per report (review_comments table)

### 4. Team dashboard (manager)
- [ ] All reports for a selected week
- [ ] Filters: member · project · date range · status (incl. "not started")
- [ ] Open any report → review action
- [ ] Bonus: side-by-side section view (e.g. all blockers) for a week

### 5. Projects / categories
- [ ] CRUD page (list + actions, not just a modal) · assign members (optional)

### 6. Dashboard & visual insights (manager)
- [ ] Metrics: submitted this week · compliance rate (submitted/pending/late) · needs-correction count · open blockers
- [ ] Charts: tasks-completed trend · status per member · workload by project · time by task type
- [ ] Activity feed incl. review actions

### 7. Pages (need ≥7 of their list — targeting 10)
- [ ] Login · Register · My Report History · Report Editor · Report Detail (both roles) · Manager Review (in report detail) · Team Week view (bonus: side-by-side) · Member Profile (manager) · Projects · User Management

### 8. AI chat assistant (bonus)
- [ ] Manager chat widget · Q&A over report data · team summary · prompt design documented in slides

## Scope floor (from "Scope & Difficulty Expectations")
- [ ] ≥7 pages on real backend data
- [ ] Full cycle demo-able: submit → needs correction → edit → resubmit → approve
- [ ] Seed: 5 members + several weeks, mixed statuses
- [ ] ≥1 RBAC automated test
- [ ] Deployed link (bonus — Vercel + Neon, decide Day 5)

## Data model

```
users(id, name, email, passwordHash, role[MEMBER|MANAGER], createdAt)
projects(id, name, description, createdAt)
project_members(projectId, userId)            -- optional assignment feature
reports(id, userId, projectId, weekStart, weekEnd,
        status[DRAFT|SUBMITTED|NEEDS_CORRECTION|APPROVED],
        currentVersionId, submittedAt, reviewedAt, createdAt, updatedAt)
report_versions(id, reportId, versionNo,
        tasks Jsonb           [{name, priority, plannedPct, actualPct, status, timePlannedH, timeSpentH, deliverable}],
        nextWeekTasks Jsonb   [string],
        blockers Jsonb        [{text, isKey}],
        achievements Jsonb    [{text, isKey}],
        hoursByType Jsonb     {development, testing, meetings, documentation},
        notes, createdAt)     -- snapshot per submit → version history for free
review_comments(id, reportId, versionId, managerId, comment, createdAt)
```

## API surface

- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET/POST /api/reports` (list: paginate + filters member/project/status/date) · `GET/PUT /api/reports/:id`
- `POST /api/reports/:id/submit` · `POST /api/reports/:id/approve` 🛡 · `POST /api/reports/:id/request-changes` 🛡
- `GET /api/reports/:id/versions` · `GET /api/reports/:id/comments`
- `GET /api/dashboard/summary` 🛡 · `GET /api/dashboard/charts` 🛡 · `GET /api/dashboard/activity` 🛡
- `GET /api/team` 🛡 · `GET /api/team/:id` 🛡 (profile + stats + history)
- `CRUD /api/projects` (write 🛡) · `GET /api/users` 🛡 · `PUT /api/users/:id` 🛡 (role/activate)
- `POST /api/ai/chat` 🛡
🛡 = manager-only, enforced in server middleware + checked in service layer; every report route re-checks ownership.

## Build schedule (6 days)

| Day | Goal |
|---|---|
| 1 Thu | Scaffold: Nuxt 4 + Prisma + Postgres (docker-compose), auth + RBAC middleware, seed data |
| 2 Fri | Reports CRUD, statuses, submit/approve/request-changes, version snapshots |
| 3 Sat | Manager dashboard (metrics + charts + filters), team week view, projects CRUD |
| 4 Sun | User management, member profile, activity feed, form validation, RBAC tests |
| 5 Mon | AI assistant, ER diagram, README, deploy (bonus, if time) |
| 6 Tue | Buffer · slides · record video (face on) · verify links · submit |

## Deliverables checklist (submit to careers@sisencodigital.com)
- [ ] GitHub repo: frontend + backend + setup README (install FE, BE, DB)
- [ ] ER diagram image
- [ ] Google Slides: architecture · DB design · key components · API/RBAC · workflow · AI approach · challenges · future work
- [ ] Demo video (face on): walkthrough both roles · full correction cycle · 2–3 members' reports
- [ ] One Drive folder, "Anyone with the link" · both links in email body

## Setup log
- Project home: `F:\Projects\SF-Assignment` (repo root = this folder)
