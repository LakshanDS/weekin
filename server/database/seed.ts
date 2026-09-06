// Seed: 2 managers, 5 members, 4 projects, 6 weeks of reports in mixed statuses.
// Deterministic content (no Math.random) so re-seeding gives the same demo data.
// Run: bun server/database/seed.ts   (bun auto-loads .env)

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import {
  users,
  projects,
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
} from '../../shared/types/report'

const database = drizzle(postgres(process.env.NUXT_DATABASE_URL!, { max: 1 }), {
  schema: { users, projects, reports, reportVersions, reviewComments },
})

const DEMO_PASSWORD = 'password123'

// ---------- date helpers ----------

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

// Week ranges: index 0 = 5 weeks ago ... index 5 = current week
const WEEKS = Array.from({ length: 6 }, (_, i) => {
  const monday = addDays(mondayOf(new Date()), -7 * (5 - i))
  return { weekStart: monday, weekEnd: addDays(monday, 4) }
})

// ---------- content generation ----------

const TASK_POOL = [
  { name: 'Implement payment retry flow', deliverable: 'PR #142 merged to main' },
  { name: 'Fix pagination bug in orders list', deliverable: 'Bugfix release 2.4.1' },
  { name: 'Build settings page UI', deliverable: 'Settings module in staging' },
  { name: 'Write API integration tests', deliverable: '42 tests passing in CI' },
  { name: 'Migrate image storage to CDN', deliverable: 'Migration script + rollback plan' },
  { name: 'Design review with client team', deliverable: 'Signed-off wireframes v2' },
  { name: 'Refactor notification service', deliverable: 'Service split into 3 modules' },
  { name: 'Patch auth token expiry issue', deliverable: 'Hotfix 2.4.2 deployed' },
  { name: 'Prepare sprint demo deck', deliverable: '10-slide demo deck' },
  { name: 'Optimize dashboard query performance', deliverable: 'P95 latency 1.8s → 400ms' },
  { name: 'Set up error tracking alerts', deliverable: 'Alert rules in monitoring' },
  { name: 'Draft onboarding documentation', deliverable: 'Onboarding guide v1' },
]

const BLOCKERS = [
  'Waiting on staging database refresh from DevOps',
  'Client feedback on checkout flow is overdue',
  'Third-party email API rate limits blocking load tests',
  'Legacy module has no test coverage, changes are risky',
  'Design handoff missing mobile breakpoints',
  '',
  '',
]

const ACHIEVEMENTS = [
  'Shipped the customer portal release two days early',
  'Cut dashboard load time by 60%',
  'Closed 14 bugs from the support backlog',
  'Automated the weekly release checklist',
  'Positive client feedback on the new reports page',
  'Mentored intern on first merged PR',
]

const NEXT_WEEK = [
  'Start OAuth login integration',
  'Complete inventory export feature',
  'Investigate flaky E2E tests',
  'Draft Q3 architecture proposal',
  'Pair with QA on regression suite',
  'Clean up deprecated API endpoints',
]

const REQUEST_CHANGES_COMMENTS = [
  'Planned vs actual percentages do not add up for the delivery tasks — please re-check the numbers and explain the slip.',
  'Task descriptions are too vague to review ("misc work"). Break them into concrete items with deliverables.',
  'Time spent exceeds plan by a wide margin without explanation. Add a note on what caused the overrun.',
  'Blockers section is empty but two tasks are still at 40%. Flag what is holding them up.',
  'Please separate testing hours from development hours so the team numbers stay comparable.',
]

const APPROVE_COMMENTS = [
  'Revised numbers look right now. Good turnaround.',
  'Much clearer after the update — approved.',
  'Thanks for the detailed follow-up.',
  '',
  '',
]

const HOUR_TYPE_MIX: HoursByType[] = [
  { development: 22, testing: 6, meetings: 4, documentation: 2 },
  { development: 16, testing: 10, meetings: 6, documentation: 3 },
  { development: 26, testing: 4, meetings: 3, documentation: 1 },
  { development: 12, testing: 8, meetings: 8, documentation: 6 },
  { development: 20, testing: 8, meetings: 5, documentation: 2 },
]

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!
}

function makeTasks(memberIdx: number, weekIdx: number, revised: boolean): TaskItem[] {
  const count = 3 + ((memberIdx + weekIdx) % 2) // 3 or 4 tasks
  return Array.from({ length: count }, (_, k) => {
    const seed = memberIdx * 31 + weekIdx * 17 + k * 7
    const plannedPct = 25 + (seed % 4) * 25 // 25..100
    const done = k < count - 1 || weekIdx < WEEKS.length - 2 // older weeks: all done
    const status: TaskStatus = done ? 'DONE' : pick<TaskStatus>(['IN_PROGRESS', 'BLOCKED', 'TODO'], seed)
    const drift = revised ? 5 : (seed % 3) * 5 // revision tightened the numbers
    return {
      name: pick(TASK_POOL, seed).name,
      priority: pick(['LOW', 'MEDIUM', 'HIGH'] as const, seed + 1),
      plannedPct,
      actualPct: done ? Math.min(100, plannedPct + drift - (seed % 2 ? 0 : 10)) : Math.max(0, plannedPct - 40 - (seed % 3) * 10),
      status,
      timePlannedH: 4 + (seed % 4) * 4,
      timeSpentH: done ? 4 + (seed % 5) * 4 : Math.max(1, 2 + (seed % 3)),
      deliverable: done ? pick(TASK_POOL, seed).deliverable : '—',
    }
  })
}

function makeContent(memberIdx: number, weekIdx: number, revised = false) {
  const seed = memberIdx * 31 + weekIdx * 17
  const blockers = pick(BLOCKERS, seed + (revised ? 1 : 0))
    ? [{ text: pick(BLOCKERS, seed + (revised ? 1 : 0)), isKey: true }]
    : []
  const tasks = makeTasks(memberIdx, weekIdx, revised)
  return {
    tasks,
    nextWeekTasks: [pick(NEXT_WEEK, seed), pick(NEXT_WEEK, seed + 3)],
    blockers,
    achievements: [{ text: pick(ACHIEVEMENTS, seed + (revised ? 2 : 0)), isKey: true }],
    hoursByType: pick(HOUR_TYPE_MIX, seed + (revised ? 1 : 0)),
    notes: revised ? 'Updated per review feedback: numbers re-checked, blocker clarified.' : null,
  }
}

// ---------- seed data ----------

// Status per member per week (index 0 = oldest week, 5 = current week)
//   A  = approved (first submission)        AC = approved after one correction cycle
//   NC = currently needs correction         S  = submitted, awaiting review
//   D  = draft                              null = no report that week
const PLAN: Record<string, (string | null)[]> = {
  'alice@demo.io':    ['A', 'A', 'AC', 'NC', 'A', 'S'],
  'bob@demo.io':      ['A', 'AC', 'A', 'S', 'NC', 'S'],
  'chatura@demo.io':  ['A', 'A', 'AC', 'NC', 'S', null],
  'dilini@demo.io':   ['A', 'A', 'A', 'AC', 'A', 'NC'],
  'ethan@demo.io':    ['AC', 'A', 'S', 'A', 'D', null],
}

// Weeks where the submission was late (after Friday)
const LATE_WEEKS = new Set(['bob@demo.io:3', 'chatura@demo.io:4'])

async function main() {
  // The seed WIPES all data and installs known demo credentials — require intent.
  if (process.env.ALLOW_DEMO_SEED !== '1') {
    console.error('Refusing to seed: this deletes all data. Re-run with ALLOW_DEMO_SEED=1.')
    process.exit(1)
  }
  console.log('Seeding…')

  // Wipe in FK-safe order — keeps the seed idempotent
  await database.delete(reviewComments)
  await database.delete(reportVersions)
  await database.delete(reports)
  await database.delete(projects)
  await database.delete(users)

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  const managerRows = await database
    .insert(users)
    .values([
      // Explicit ACTIVE: the column default is PENDING (only self-signup should be pending).
      { name: 'Ruwan Jayasuriya', email: 'manager@demo.io', passwordHash, role: 'MANAGER' as const, status: 'ACTIVE' as const },
      { name: 'Nadia Fernando', email: 'manager2@demo.io', passwordHash, role: 'MANAGER' as const, status: 'ACTIVE' as const },
    ])
    .returning()
  const [manager, manager2] = managerRows

  const members = await database
    .insert(users)
    .values(
      [
        { name: 'Alice Fernando', email: 'alice@demo.io' },
        { name: 'Bob Perera', email: 'bob@demo.io' },
        { name: 'Chatura Silva', email: 'chatura@demo.io' },
        { name: 'Dilini Jayawardena', email: 'dilini@demo.io' },
        { name: 'Ethan Kumara', email: 'ethan@demo.io' },
      ].map((u) => ({ ...u, passwordHash, role: 'MEMBER' as const, status: 'ACTIVE' as const })),
    )
    .returning()
  const memberIdx = new Map(members.map((m, i) => [m.email, i]))

  const projectRows = await database
    .insert(projects)
    .values([
      { name: 'Client A Portal', description: 'Customer-facing portal for Client A' },
      { name: 'Internal Tooling', description: 'Tools and dashboards for internal teams' },
      { name: 'R&D', description: 'Research and spikes' },
      { name: 'Marketing Site', description: 'Public website and landing pages' },
    ])
    .returning()
  const projectIds = projectRows.map((p) => p.id)

  let reportCount = 0
  let versionCount = 0
  let commentCount = 0

  for (const member of members) {
    const mi = memberIdx.get(member.email)!

    for (let wi = 0; wi < WEEKS.length; wi++) {
      const kind = PLAN[member.email]![wi]
      if (!kind) continue

      const week = WEEKS[wi]
      const projectId = pick(projectIds, mi + wi)
      // Alternate the assigned manager per member so both review queues look real.
      const assignedManager = mi % 2 === 0 ? manager : manager2
      const isLate = LATE_WEEKS.has(`${member.email}:${wi}`)
      const submittedAt = new Date(
        `${isLate ? addDays(week.weekEnd, 1) : week.weekEnd}T17:${isLate ? '4' : '0'}0:00Z`,
      )
      const draft = kind === 'D'

      const [report] = await database
        .insert(reports)
        .values({
          userId: member.id,
          projectId,
          assignedManagerId: assignedManager.id,
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          status: kind === 'D' ? 'DRAFT' : kind === 'S' ? 'SUBMITTED' : kind === 'NC' ? 'NEEDS_CORRECTION' : 'APPROVED',
          submittedAt: draft ? null : submittedAt,
          reviewedAt: kind === 'A' || kind === 'AC' ? submittedAt : null,
          createdAt: new Date(`${week.weekStart}T09:00:00Z`),
          updatedAt: submittedAt,
        })
        .returning()
      reportCount++

      const insertVersion = (revised: boolean, submitted: boolean) =>
        database
          .insert(reportVersions)
          .values({
            reportId: report.id,
            versionNo: revised ? 2 : 1,
            ...makeContent(mi, wi, revised),
            submittedAt: submitted ? submittedAt : null,
            createdAt: new Date(`${revised ? addDays(week.weekEnd, 2) : week.weekStart}T1${revised ? 1 : 0}:00:00Z`),
          })
          .returning()

      if (draft) {
        await insertVersion(false, false)
        versionCount++
        continue
      }

      const [v1] = await insertVersion(false, true)
      versionCount++

      if (kind === 'AC' || kind === 'NC') {
        await database.insert(reviewComments).values({
          reportId: report.id,
          versionId: v1.id,
          managerId: assignedManager.id,
          action: 'REQUEST_CHANGES',
          comment: pick(REQUEST_CHANGES_COMMENTS, mi * 5 + wi),
          createdAt: submittedAt,
        })
        commentCount++
      }

      if (kind === 'AC') {
        const [v2] = await insertVersion(true, true)
        versionCount++
        const approveComment = pick(APPROVE_COMMENTS, mi + wi)
        if (approveComment) {
          await database.insert(reviewComments).values({
            reportId: report.id,
            versionId: v2.id,
            managerId: assignedManager.id,
            action: 'APPROVE',
            comment: approveComment,
            createdAt: new Date(`${addDays(week.weekEnd, 2)}T15:00:00Z`),
          })
          commentCount++
        }
      }

      if (kind === 'A') {
        const approveComment = pick(APPROVE_COMMENTS, mi * 3 + wi)
        if (approveComment) {
          await database.insert(reviewComments).values({
            reportId: report.id,
            versionId: v1.id,
            managerId: assignedManager.id,
            action: 'APPROVE',
            comment: approveComment,
            createdAt: submittedAt,
          })
          commentCount++
        }
      }
    }
  }

  console.log(
    `Done. users=${members.length + 2} projects=${projectRows.length} reports=${reportCount} versions=${versionCount} comments=${commentCount}`,
  )
  console.log(`Manager logins: manager@demo.io, manager2@demo.io / ${DEMO_PASSWORD}`)
  console.log(`Member login:   alice@demo.io / ${DEMO_PASSWORD} (all members use the same password)`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
