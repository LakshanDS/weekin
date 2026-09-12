// Demo seed: 3 managers, 10 members, 6 projects and ~a year of weekly reports
// across every workflow status. Deterministic (seeded PRNG) — re-running rebuilds
// the same dataset. Run: ALLOW_DEMO_SEED=1 bun server/database/seed.demo.ts

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import {
  users,
  projects,
  projectMembers,
  reports,
  reportVersions,
  reviewComments,
} from './schema'
import type {
  TaskItem,
  BlockerItem,
  AchievementItem,
  HoursByType,
  TaskStatus,
  TaskPriority,
} from '../../shared/types/report'

const database = drizzle(postgres(process.env.NUXT_DATABASE_URL!, { max: 1 }), {
  schema: { users, projects, projectMembers, reports, reportVersions, reviewComments },
})

const DEMO_PASSWORD = 'password123'
const YEAR_WEEKS = 52 // including the current week

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260907)
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))
const chance = (p: number) => rnd() < p
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!
}

function toIso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return toIso(d)
}

function mondayOf(d: Date) {
  const day = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - day)
  return toIso(d)
}

function addHours(d: Date, hours: number) {
  return new Date(d.getTime() + hours * 3_600_000)
}

const NOW = Date.now()
// Correction cycles can land in the future when the seed runs early in the week — clamp to now.
function clampPast(d: Date) {
  return new Date(Math.min(d.getTime(), NOW - 60_000))
}

// Weeks: index 0 = 51 weeks ago ... index 51 = current week
const WEEKS = Array.from({ length: YEAR_WEEKS }, (_, i) => {
  const monday = addDays(mondayOf(new Date()), -7 * (YEAR_WEEKS - 1 - i))
  return { weekStart: monday, weekEnd: addDays(monday, 4) }
})

const MANAGERS = [
  { name: 'Ruwan Jayasuriya', email: 'manager@demo.io' },
  { name: 'Nadia Fernando', email: 'manager2@demo.io' },
  { name: 'Dilan Wickramasinghe', email: 'manager3@demo.io' },
]

// startWeek: when the person joined — no reports before that week
const MEMBERS = [
  { name: 'Alice Fernando', email: 'alice@demo.io', startWeek: 0 },
  { name: 'Bob Perera', email: 'bob@demo.io', startWeek: 0 },
  { name: 'Chatura Silva', email: 'chatura@demo.io', startWeek: 0 },
  { name: 'Dilini Jayawardena', email: 'dilini@demo.io', startWeek: 0 },
  { name: 'Ethan Kumara', email: 'ethan@demo.io', startWeek: 0 },
  { name: 'Fiona Lawrence', email: 'fiona@demo.io', startWeek: 8 },
  { name: 'Gihan Wickramanayake', email: 'gihan@demo.io', startWeek: 20 },
  { name: 'Hansika Perera', email: 'hansika@demo.io', startWeek: 33 },
  { name: 'Isuru Bandara', email: 'isuru@demo.io', startWeek: 44 },
  { name: 'Nadun Rajapaksha', email: 'nadun@demo.io', startWeek: 48 },
]

// Self-registered, still waiting in the manager's approval queue
const PENDING_MEMBERS = [
  { name: 'Oshadi Gunasekara', email: 'oshadi@demo.io' },
  { name: 'Peter Novak', email: 'peter@demo.io' },
]

const PROJECTS = [
  {
    name: 'Client A Portal',
    description: 'Customer-facing portal for Client A',
    tasks: [
      ['Build invoice export API', 'Export endpoint live in prod'],
      ['Add SSO login for enterprise tenants', 'SSO flow merged, staged rollout'],
      ['Fix timezone bug in booking calendar', 'Patched in release 3.2.1'],
      ['Redesign billing history page', 'New page in staging'],
      ['Add rate limiting to public API', 'Gateway rules deployed'],
      ['Write E2E tests for checkout flow', '18 E2E specs running in CI'],
      ['Migrate uploads to object storage', 'Migration runbook + cutover'],
      ['Prepare client demo environment', 'Demo env refreshed with clean data'],
    ],
  },
  {
    name: 'Internal Tooling',
    description: 'Tools and dashboards for internal teams',
    tasks: [
      ['Ship flaky-test dashboard', 'Dashboard v1 used by 3 squads'],
      ['Automate release notes generation', 'Bot posts notes per release'],
      ['Centralize logging configuration', 'Shared log pipeline live'],
      ['Build feature-flag admin UI', 'Admin UI in staging'],
      ['Optimize CI cache strategy', 'Pipeline down from 22 to 9 minutes'],
      ['Migrate legacy cron jobs', '6 jobs moved to the scheduler'],
      ['Refresh on-call runbooks', 'Runbooks reviewed with the team'],
      ['Access-request self-service form', 'Form live on the intranet'],
    ],
  },
  {
    name: 'R&D',
    description: 'Research spikes and feasibility studies',
    tasks: [
      ['Vector search spike on pgvector', 'Benchmark write-up + repo'],
      ['Evaluate auth providers', 'Comparison doc shared'],
      ['Prototype realtime collaboration', 'Working prototype demoed'],
      ['LLM summarizer feasibility test', 'Eval harness + results doc'],
      ['Benchmark event streaming options', 'Decision record drafted'],
      ['Explore offline-first sync', 'Tech brief with tradeoffs'],
      ['Cost model for GPU inference', 'Spreadsheet + recommendation'],
      ['Mentor hackathon teams', '2 team projects shipped'],
    ],
  },
  {
    name: 'Marketing Site',
    description: 'Public website and landing pages',
    tasks: [
      ['Launch pricing page A/B test', 'Variant B live, tracking on'],
      ['SEO cleanup of legacy blog', '40 redirects mapped'],
      ['Build careers page CMS block', 'Editors can update postings'],
      ['Improve Lighthouse score', 'Mobile 62 → 91'],
      ['Localization scaffolding', 'i18n routing in place'],
      ['Newsletter signup flow', 'Double opt-in live'],
      ['Customer story templates', '3 new stories published'],
      ['Rework cookie consent', 'Compliant banner deployed'],
    ],
  },
  {
    name: 'Mobile App Revamp',
    description: 'Cross-platform mobile client rewrite',
    tasks: [
      ['Implement biometric login', 'FaceID/fingerprint in TestFlight'],
      ['Offline mode for saved reports', 'Local cache + sync queue'],
      ['Push notification service', 'Segmented campaigns live'],
      ['Redesign navigation shell', 'New nav behind feature flag'],
      ['Reduce crash rate', 'Crash-free sessions 98.1% → 99.6%'],
      ['Deep links from email digests', 'Universal links verified'],
      ['Fix accessibility audit findings', '22 issues closed'],
      ['Refresh store listings', 'New screenshots approved'],
    ],
  },
  {
    name: 'Data Platform',
    description: 'Warehouse, pipelines and analytics',
    tasks: [
      ['Model weekly active users table', 'dbt model + tests green'],
      ['Backfill two years of events', 'Backfill job completed'],
      ['Streaming ingestion for orders', 'Kafka topic + consumer live'],
      ['Data quality alerts', '12 freshness/alert rules on-call'],
      ['Optimize warehouse spend', 'Monthly cost cut by 18%'],
      ['Build exec KPI dashboard', 'Dashboard adopted by leadership'],
      ['Roll out PII masking', 'Masking policies in prod'],
      ['Document retention policy', 'Policy reviewed with legal'],
    ],
  },
]

const BLOCKERS = [
  'Waiting on staging database refresh from DevOps',
  'Client feedback on the checkout flow is overdue',
  'Third-party email API rate limits blocking load tests',
  'Legacy module has no test coverage, changes are risky',
  'Design handoff missing mobile breakpoints',
  'Security review queue is two sprints deep',
  'Waiting on legal sign-off for the data sharing agreement',
  'Flaky test blocks the release pipeline most mornings',
  'Need prod access approval before the migration window',
  '',
  '',
]

const ACHIEVEMENTS = [
  'Shipped the release two days early',
  'Cut page load time by 60%',
  'Closed 14 bugs from the support backlog',
  'Automated the weekly release checklist',
  'Positive client feedback on the new reports page',
  'Mentored an intern through their first merged PR',
  'Zero-downtime migration completed on Saturday',
  'Test coverage up from 61% to 78%',
  'Ran the sprint demo for the client exec team',
  'Fixed a production incident in under 30 minutes',
]

const NEXT_WEEK_TASKS = [
  'Start OAuth login integration',
  'Complete inventory export feature',
  'Investigate flaky E2E tests',
  'Draft the next architecture proposal',
  'Pair with QA on the regression suite',
  'Clean up deprecated API endpoints',
  'Onboard the new team member',
  'Prepare the client steering committee update',
  'Reduce test suite runtime',
  'Review the pull request backlog',
]

const REQUEST_CHANGES_COMMENTS = [
  'Planned vs actual percentages do not add up for the delivery tasks — please re-check the numbers and explain the slip.',
  'Task descriptions are too vague to review ("misc work"). Break them into concrete items with deliverables.',
  'Time spent exceeds plan by a wide margin without explanation. Add a note on what caused the overrun.',
  'Blockers section is empty but two tasks are still at 40%. Flag what is holding them up.',
  'Please separate testing hours from development hours so the team numbers stay comparable.',
  'The deliverables column is mostly "—" — list what actually shipped for each done task.',
  'Next-week plan is missing. Add what you intend to pick up so I can balance the sprint.',
  'The blocked task has no linked ask — what do you need, and from whom?',
]

const APPROVE_COMMENTS = [
  'Revised numbers look right now. Good turnaround.',
  'Much clearer after the update — approved.',
  'Thanks for the detailed follow-up.',
  'Solid week, especially the migration work.',
  '',
  '',
]

const REVISION_NOTES = [
  'Updated per review feedback: percentages re-checked and the blocker clarified.',
  'Revision: vague items split into concrete tasks with deliverables listed.',
  'Addressed the overrun question — the extra hours came from Tuesday’s incident.',
]

const NOTES = [
  'Short week — public holiday on Monday.',
  'Half-day leave on Friday, hours adjusted.',
]

// Status legend for kindForWeek():
//   A=approved, first submission  AC=approved after one correction cycle  ACC=after two
//   S=submitted, awaiting review  NC=needs correction  D=draft  null=no report that week
function kindForWeek(weekIdx: number): 'A' | 'AC' | 'ACC' | 'S' | 'NC' | 'D' | null {
  const last = YEAR_WEEKS - 1
  if (weekIdx === last) {
    const r = rnd()
    if (r < 0.15) return null // hasn't written this week's report yet
    if (r < 0.6) return 'D'
    return 'S'
  }
  if (weekIdx === last - 1) {
    const r = rnd()
    if (r < 0.05) return null
    if (r < 0.4) return 'S'
    if (r < 0.55) return 'NC'
    if (r < 0.68) return 'AC'
    return 'A'
  }
  const r = rnd()
  if (r < 0.03) return null // leave / gap
  if (r < 0.83) return 'A'
  if (r < 0.96) return 'AC'
  if (r < 0.98) return 'ACC'
  return 'S' // stale submission in the manager backlog
}

function makeTasks(projectIdx: number, weekIdx: number, revised: number): TaskItem[] {
  const pool = PROJECTS[projectIdx]!.tasks
  const isCurrentWeek = weekIdx === YEAR_WEEKS - 1
  const count = 3 + ((projectIdx + weekIdx + revised) % 3) // 3-5 tasks
  return Array.from({ length: count }, (_, k) => {
    const [name, deliverable] = pool[(projectIdx * 5 + weekIdx * 3 + k * 7 + revised * 2) % pool.length]!
    const priority = pick<TaskPriority>(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH'])
    const plannedPct = pick([25, 50, 50, 75, 100])
    const timePlannedH = randInt(3, 14)

    if (isCurrentWeek) {
      // This week is still happening: tasks mid-flight, no final deliverables yet.
      const status = pick<TaskStatus>(['IN_PROGRESS', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'TODO'])
      const done = status === 'DONE'
      return {
        name,
        priority,
        plannedPct,
        status,
        actualPct: done ? 100 : Math.max(5, plannedPct - randInt(25, 55)),
        timePlannedH,
        timeSpentH: done ? randInt(2, timePlannedH + 2) : randInt(1, Math.max(2, Math.round(timePlannedH / 2))),
        deliverable: done ? deliverable : '—',
      }
    }

    // Submitted weeks: work wrapped up. First submissions drift, revisions tighten.
    const slip = revised === 0 ? randInt(-10, 15) : randInt(-4, 5)
    const blocked = revised === 0 && chance(0.05)
    return {
      name,
      priority,
      plannedPct,
      status: blocked ? 'BLOCKED' : 'DONE',
      actualPct: Math.max(5, Math.min(100, plannedPct + slip)),
      timePlannedH,
      timeSpentH: Math.max(1, timePlannedH + (revised === 0 ? randInt(-2, 4) : randInt(-1, 1))),
      deliverable: blocked ? '—' : deliverable,
    }
  })
}

function makeContent(projectIdx: number, weekIdx: number, revised: number) {
  const blockerText = chance(0.65) ? pick(BLOCKERS) : ''
  const blockers: BlockerItem[] = blockerText ? [{ text: blockerText, isKey: true }] : []
  const achievements: AchievementItem[] = [
    { text: pick(ACHIEVEMENTS), isKey: true },
    ...(chance(0.25) ? [{ text: pick(ACHIEVEMENTS), isKey: false }] : []),
  ]
  const nextWeekTasks = [
    pick(NEXT_WEEK_TASKS),
    pick(NEXT_WEEK_TASKS),
    ...(chance(0.3) ? [pick(NEXT_WEEK_TASKS)] : []),
  ]
  const hoursByType: HoursByType = {
    development: randInt(14, 26),
    testing: randInt(4, 12),
    meetings: randInt(3, 8),
    documentation: randInt(0, 6),
  }
  const notes = revised > 0 ? pick(REVISION_NOTES) : chance(0.15) ? pick(NOTES) : null
  return {
    tasks: makeTasks(projectIdx, weekIdx, revised),
    nextWeekTasks,
    blockers,
    achievements,
    hoursByType,
    notes,
  }
}

type VersionDraft = {
  reportIdx: number
  versionNo: number
  content: ReturnType<typeof makeContent>
  submittedAt: Date | null
  createdAt: Date
}

type CommentDraft = {
  reportIdx: number
  versionRef: number
  managerId: number
  action: 'REQUEST_CHANGES' | 'APPROVE'
  comment: string | null
  createdAt: Date
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  // The seed WIPES all data and installs known demo credentials — require intent.
  if (process.env.ALLOW_DEMO_SEED !== '1') {
    console.error('Refusing to seed: this deletes all data. Re-run with ALLOW_DEMO_SEED=1.')
    process.exit(1)
  }
  console.log('Seeding a year of data…')

  // Wipe in FK-safe order — keeps the seed idempotent
  await database.delete(reviewComments)
  await database.delete(reportVersions)
  await database.delete(reports)
  await database.delete(projects)
  await database.delete(users)

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  const managers = await database
    .insert(users)
    .values(
      MANAGERS.map((m) => ({
        ...m,
        passwordHash,
        role: 'MANAGER' as const,
        status: 'ACTIVE' as const,
        createdAt: new Date(`${WEEKS[0]!.weekStart}T09:00:00Z`),
      })),
    )
    .returning()

  const members = await database
    .insert(users)
    .values(
      MEMBERS.map((m) => ({
        name: m.name,
        email: m.email,
        passwordHash,
        role: 'MEMBER' as const,
        status: 'ACTIVE' as const,
        createdAt: new Date(`${WEEKS[m.startWeek]!.weekStart}T09:00:00Z`),
      })),
    )
    .returning()

  await database.insert(users).values([
    { ...PENDING_MEMBERS[0]!, passwordHash, createdAt: new Date(`${WEEKS[YEAR_WEEKS - 2]!.weekStart}T14:00:00Z`) },
    { ...PENDING_MEMBERS[1]!, passwordHash, createdAt: new Date(`${WEEKS[YEAR_WEEKS - 1]!.weekStart}T11:00:00Z`) },
  ])

  const projectRows = await database
    .insert(projects)
    .values(PROJECTS.map((p) => ({ name: p.name, description: p.description })))
    .returning()

  // Two assignments per member — the form only offers assigned projects; memberRnd
  // is a fresh stream so the report data below stays deterministic.
  const memberRnd = mulberry32(20260907)
  await database.insert(projectMembers).values(
    members.flatMap((member, mi) => {
      const primary = mi % projectRows.length
      const other = Math.floor(memberRnd() * (projectRows.length - 1)) // 0..n-2, bumped past primary below
      return [
        { projectId: projectRows[primary]!.id, userId: member.id },
        { projectId: projectRows[other < primary ? other : other + 1]!.id, userId: member.id },
      ]
    }),
  )

  const reportRows: Omit<typeof reports.$inferInsert, 'id'>[] = []
  const versionDrafts: VersionDraft[] = []
  const commentDrafts: CommentDraft[] = []

  members.forEach((member, mi) => {
    const primaryProject = mi % projectRows.length
    const manager = managers[mi % managers.length]!

    for (let wi = MEMBERS[mi]!.startWeek; wi < YEAR_WEEKS; wi++) {
      const kind = kindForWeek(wi)
      if (!kind) continue

      const week = WEEKS[wi]!
      const projectIdx = chance(0.7) ? primaryProject : randInt(0, projectRows.length - 1)
      const projectId = chance(0.02) ? null : projectRows[projectIdx]!.id
      const assignedManagerId = wi < 15 && chance(0.05) ? null : manager.id
      const reportIdx = reportRows.length
      const createdAt = clampPast(new Date(`${week.weekStart}T09:${String(pick([0, 15, 30, 45])).padStart(2, '0')}:00Z`))

      if (kind === 'D') {
        reportRows.push({
          userId: member.id,
          projectId,
          assignedManagerId,
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          status: 'DRAFT',
          submittedAt: null,
          reviewedAt: null,
          createdAt,
          updatedAt: createdAt,
        })
        versionDrafts.push({ reportIdx, versionNo: 1, content: makeContent(projectIdx, wi, 0), submittedAt: null, createdAt })
        continue
      }

      const late = chance(0.08)
      const submittedAt = clampPast(
        new Date(`${late ? addDays(week.weekEnd, 1) : week.weekEnd}T${randInt(15, 18)}:${String(pick([0, 15, 30, 45])).padStart(2, '0')}:00Z`),
      )

      const firstReviewAt = clampPast(addHours(submittedAt, randInt(3, 24)))
      const v2SubmittedAt = clampPast(addHours(submittedAt, randInt(40, 72)))
      const secondReviewAt = clampPast(addHours(v2SubmittedAt, randInt(2, 12)))
      const v3SubmittedAt = clampPast(addHours(secondReviewAt, randInt(20, 48)))
      const finalReviewAt = clampPast(addHours(v3SubmittedAt, randInt(2, 16)))
      const approvedAt =
        kind === 'ACC' ? finalReviewAt : kind === 'AC' ? clampPast(addHours(v2SubmittedAt, randInt(2, 20))) : clampPast(addHours(submittedAt, randInt(1, 30)))

      const status = kind === 'S' ? 'SUBMITTED' : kind === 'NC' ? 'NEEDS_CORRECTION' : 'APPROVED'
      const updatedAt = kind === 'S' ? submittedAt : kind === 'NC' ? firstReviewAt : approvedAt
      reportRows.push({
        userId: member.id,
        projectId,
        assignedManagerId,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        status,
        submittedAt,
        reviewedAt: status === 'APPROVED' ? approvedAt : null,
        createdAt,
        updatedAt,
      })

      versionDrafts.push({ reportIdx, versionNo: 1, content: makeContent(projectIdx, wi, 0), submittedAt, createdAt })
      const v1Ref = versionDrafts.length - 1

      if (kind === 'NC' || kind === 'AC' || kind === 'ACC') {
        commentDrafts.push({
          reportIdx,
          versionRef: v1Ref,
          managerId: assignedManagerId ?? manager.id,
          action: 'REQUEST_CHANGES',
          comment: chance(0.9) ? pick(REQUEST_CHANGES_COMMENTS) : null,
          createdAt: firstReviewAt,
        })
      }
      if (kind === 'AC' || kind === 'ACC') {
        versionDrafts.push({ reportIdx, versionNo: 2, content: makeContent(projectIdx, wi, 1), submittedAt: v2SubmittedAt, createdAt: v2SubmittedAt })
      }
      if (kind === 'ACC') {
        commentDrafts.push({
          reportIdx,
          versionRef: versionDrafts.length - 1,
          managerId: assignedManagerId ?? manager.id,
          action: 'REQUEST_CHANGES',
          comment: pick(REQUEST_CHANGES_COMMENTS),
          createdAt: secondReviewAt,
        })
        versionDrafts.push({ reportIdx, versionNo: 3, content: makeContent(projectIdx, wi, 2), submittedAt: v3SubmittedAt, createdAt: v3SubmittedAt })
      }
      if (status === 'APPROVED' && chance(0.55)) {
        commentDrafts.push({
          reportIdx,
          versionRef: versionDrafts.length - 1,
          managerId: assignedManagerId ?? manager.id,
          action: 'APPROVE',
          comment: pick(APPROVE_COMMENTS),
          createdAt: approvedAt,
        })
      }
    }
  })

  // Bulk insert: reports → versions → comments (each needs the parent ids)
  const reportIds: number[] = []
  for (const chunk of chunks(reportRows, 200)) {
    const inserted = await database.insert(reports).values(chunk).returning({ id: reports.id })
    reportIds.push(...inserted.map((r) => r.id))
  }

  const versionIds: number[] = []
  for (const chunk of chunks(versionDrafts, 200)) {
    const inserted = await database
      .insert(reportVersions)
      .values(
        chunk.map((v) => ({
          reportId: reportIds[v.reportIdx]!,
          versionNo: v.versionNo,
          ...v.content,
          submittedAt: v.submittedAt,
          createdAt: v.createdAt,
        })),
      )
      .returning({ id: reportVersions.id })
    versionIds.push(...inserted.map((r) => r.id))
  }

  for (const chunk of chunks(commentDrafts, 200)) {
    await database.insert(reviewComments).values(
      chunk.map((c) => ({
        reportId: reportIds[c.reportIdx]!,
        versionId: versionIds[c.versionRef]!,
        managerId: c.managerId,
        action: c.action,
        comment: c.comment,
        createdAt: c.createdAt,
      })),
    )
  }

  const byStatus = reportRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  console.log(
    `Done. users=${managers.length + members.length + PENDING_MEMBERS.length} projects=${projectRows.length} ` +
      `reports=${reportRows.length} versions=${versionDrafts.length} comments=${commentDrafts.length}`,
  )
  console.log(`Reports by status: ${JSON.stringify(byStatus)}`)
  console.log(`Manager logins: ${MANAGERS.map((m) => m.email).join(', ')} / ${DEMO_PASSWORD}`)
  console.log(`Member logins:  ${MEMBERS.map((m) => m.email).join(', ')} / ${DEMO_PASSWORD}`)
  console.log(`Pending approval (no login value): ${PENDING_MEMBERS.map((m) => m.email).join(', ')} / ${DEMO_PASSWORD}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
