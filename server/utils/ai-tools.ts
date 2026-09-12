import { and, asc, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { projects, reports, reportVersions, users } from '../database/schema'
import type { AchievementItem, BlockerItem, HoursByType, TaskItem } from '../../shared/types/report'
import { addDaysIso, mondayOf } from '#shared/utils/week'
import type { ToolDef } from './ai'

// Read-only agent tools: small data volume, so SQL stays dumb and the math is testable.

interface ReportRow {
  userName: string
  status: 'DRAFT' | 'SUBMITTED' | 'NEEDS_CORRECTION' | 'APPROVED'
  projectName: string | null
  weekStart: string
  tasks: TaskItem[]
  nextWeekTasks: string[]
  blockers: BlockerItem[]
  achievements: AchievementItem[]
  hoursByType: HoursByType
  notes: string | null
}

interface RosterEntry {
  name: string
  memberSince: string
}

const MAX_WINDOW_WEEKS = 26
const DETAIL_WINDOW_WEEKS = 52

const round1 = (n: number) => Math.round(n * 10) / 10

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function windowStartOf(weeks: number): string {
  return addDaysIso(mondayOf(todayIso()), -7 * (weeks - 1))
}

function clampWeeks(value: unknown): number {
  const n = Math.floor(Number(value) || 6)
  return Math.min(Math.max(n, 1), MAX_WINDOW_WEEKS)
}

function optionalName(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function mapRound1(obj: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, round1(v)]))
}

async function fetchReportRows(windowStart: string): Promise<ReportRow[]> {
  const database = useDatabase()
  const rows = await database
    .select({
      reportId: reports.id,
      userName: users.name,
      status: reports.status,
      projectName: projects.name,
      weekStart: reports.weekStart,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.userId))
    .leftJoin(projects, eq(projects.id, reports.projectId))
    .where(and(gte(reports.weekStart, windowStart), eq(users.role, 'MEMBER')))
    .orderBy(desc(reports.weekStart))

  if (!rows.length) return []
  const versions = await database
    .selectDistinctOn([reportVersions.reportId], {
      reportId: reportVersions.reportId,
      tasks: reportVersions.tasks,
      nextWeekTasks: reportVersions.nextWeekTasks,
      blockers: reportVersions.blockers,
      achievements: reportVersions.achievements,
      hoursByType: reportVersions.hoursByType,
      notes: reportVersions.notes,
    })
    .from(reportVersions)
    .where(and(inArray(reportVersions.reportId, rows.map((r) => r.reportId)), isNotNull(reportVersions.submittedAt)))
    .orderBy(asc(reportVersions.reportId), desc(reportVersions.versionNo))
  const latest = new Map(versions.map((v) => [v.reportId, v]))

  return rows.flatMap((row) => {
    const version = latest.get(row.reportId)
    if (!version) return []
    return [
      {
        userName: row.userName,
        status: row.status,
        projectName: row.projectName,
        weekStart: row.weekStart,
        tasks: version.tasks,
        nextWeekTasks: version.nextWeekTasks,
        blockers: version.blockers,
        achievements: version.achievements,
        hoursByType: version.hoursByType,
        notes: version.notes,
      },
    ]
  })
}

async function fetchRoster(): Promise<RosterEntry[]> {
  const database = useDatabase()
  const roster = await database
    .select({ name: users.name, memberSince: users.createdAt })
    .from(users)
    .where(eq(users.role, 'MEMBER'))
  return roster.map((u) => ({ name: u.name, memberSince: u.memberSince.toISOString().slice(0, 10) }))
}

// Mondays the member was expected to file — reduced by join date, so new members don't look like no-shows.
export function expectedWeeksOf(memberSinceIso: string, windowStart: string, windowWeeks: number): number {
  const joinedMonday = mondayOf(memberSinceIso)
  const effectiveStart = joinedMonday > windowStart ? joinedMonday : windowStart
  const thisMonday = addDaysIso(windowStart, 7 * (windowWeeks - 1))
  const weeks = Math.floor((Date.parse(thisMonday) - Date.parse(effectiveStart)) / (7 * 864e5)) + 1
  return Math.min(Math.max(weeks, 0), windowWeeks)
}

// Hours come from hoursByType (the per-report convention); task-level planned/spent
// hours are reported separately in `taskTime`.
export function aggregateProjectHours(allRows: ReportRow[], project: string | undefined, windowStart: string, windowWeeks: number) {
  const rows = project ? allRows.filter((r) => r.projectName?.toLowerCase() === project.toLowerCase()) : allRows

  const byProject = new Map<string, { total: number; byType: Record<string, number>; byMember: Record<string, number> }>()
  let plannedH = 0
  let spentH = 0
  for (const row of rows) {
    const name = row.projectName ?? 'No project'
    const agg = byProject.get(name) ?? { total: 0, byType: {}, byMember: {} }
    for (const [type, hours] of Object.entries(row.hoursByType ?? {})) {
      if (!hours) continue
      agg.total += hours
      agg.byType[type] = (agg.byType[type] ?? 0) + hours
      agg.byMember[row.userName] = (agg.byMember[row.userName] ?? 0) + hours
    }
    byProject.set(name, agg)
    for (const task of row.tasks) {
      plannedH += task.timePlannedH ?? 0
      spentH += task.timeSpentH ?? 0
    }
  }

  return {
    window: { weeks: windowWeeks, from: windowStart },
    projects: [...byProject.entries()].map(([name, agg]) => ({
      project: name,
      totalHours: round1(agg.total),
      byType: mapRound1(agg.byType),
      byMember: mapRound1(agg.byMember),
    })),
    taskTime: { plannedH: round1(plannedH), spentH: round1(spentH) },
  }
}

export function aggregateMemberPerformance(allRows: ReportRow[], roster: RosterEntry[], member: string | undefined, windowStart: string, windowWeeks: number) {
  const names = member ? roster.filter((m) => m.name.toLowerCase() === member.toLowerCase()).map((m) => m.name) : roster.map((m) => m.name)

  return names.map((name) => {
    const memberRows = allRows.filter((r) => r.userName === name)
    const tasks = memberRows.flatMap((r) => r.tasks)
    const tracked = tasks.filter((t) => t.actualPct != null)
    const avgPlannedPct = tasks.length ? round1(tasks.reduce((s, t) => s + t.plannedPct, 0) / tasks.length) : null
    const avgActualPct = tracked.length ? round1(tracked.reduce((s, t) => s + (t.actualPct ?? 0), 0) / tracked.length) : null
    const hoursTotal = memberRows.reduce((sum, r) => sum + Object.values(r.hoursByType ?? {}).reduce((s, h) => s + (h ?? 0), 0), 0)
    const since = roster.find((m) => m.name === name)?.memberSince ?? windowStart

    return {
      member: name,
      weeksSubmitted: new Set(memberRows.map((r) => r.weekStart)).size,
      weeksExpected: expectedWeeksOf(since, windowStart, windowWeeks),
      tasksDone: tasks.filter((t) => t.status === 'DONE').length,
      tasksTotal: tasks.length,
      tasksBlocked: tasks.filter((t) => t.status === 'BLOCKED').length,
      avgPlannedPct,
      avgActualPct,
      hoursTotal: round1(hoursTotal),
      keyBlockers: memberRows.flatMap((r) => r.blockers).filter((b) => b.isKey).length,
      ...(memberRows.length ? {} : { note: 'no submitted reports in window' }),
    }
  })
}

// Rows arrive sorted weekStart desc, so [0] is the most recent submitted report.
export function findReportDetail(rows: ReportRow[], member: string, week: string | undefined): ReportRow | null {
  const memberRows = rows.filter((r) => r.userName.toLowerCase() === member.toLowerCase())
  if (week) return memberRows.find((r) => r.weekStart === week) ?? null
  return memberRows[0] ?? null
}

const projectHoursTool: ToolDef = {
  name: 'project_hours',
  description:
    'Hours logged per project over a week window, summed from report hoursByType (development/testing/meetings/documentation), with per-type and per-member breakdowns, plus separate task-level planned vs spent hours. Use for time-spent, effort-distribution, and overrun questions.',
  parameters: {
    type: 'object',
    properties: {
      project: { type: 'string', description: 'Project name, case-insensitive. Omit for all projects.' },
      weeks: { type: 'number', description: `Look-back window in weeks, 1-${MAX_WINDOW_WEEKS} (default 6).` },
    },
  },
  execute: async (args) => {
    const weeks = clampWeeks(args.weeks)
    const windowStart = windowStartOf(weeks)
    const rows = await fetchReportRows(windowStart)
    return JSON.stringify(aggregateProjectHours(rows, optionalName(args.project), windowStart, weeks))
  },
}

const memberPerformanceTool: ToolDef = {
  name: 'member_performance',
  description:
    'Per-member progress over a week window: submitted vs expected weeks, task completion and blocked counts, average planned/actual percent, total hours, key blockers. Use for who-is-on-track / who-is-behind questions. Self-reported data — present as trends, not verdicts.',
  parameters: {
    type: 'object',
    properties: {
      member: { type: 'string', description: 'Member name, case-insensitive. Omit for all members.' },
      weeks: { type: 'number', description: `Look-back window in weeks, 1-${MAX_WINDOW_WEEKS} (default 6).` },
    },
  },
  execute: async (args) => {
    const weeks = clampWeeks(args.weeks)
    const windowStart = windowStartOf(weeks)
    const [rows, roster] = await Promise.all([fetchReportRows(windowStart), fetchRoster()])
    return JSON.stringify(aggregateMemberPerformance(rows, roster, optionalName(args.member), windowStart, weeks))
  },
}

const reportDetailTool: ToolDef = {
  name: 'report_detail',
  description:
    "Full content of a member's submitted weekly report: tasks (status, priority, planned/actual %, planned/spent hours, deliverable), next-week tasks, blockers, achievements, notes, report status. Use to drill into one member-week.",
  parameters: {
    type: 'object',
    properties: {
      member: { type: 'string', description: 'Member name, case-insensitive (required).' },
      week: { type: 'string', description: "Report week as ISO date 'YYYY-MM-DD' inside that week (defaults to the member's most recent submitted report)." },
    },
    required: ['member'],
  },
  execute: async (args) => {
    const member = optionalName(args.member)
    if (!member) return JSON.stringify({ error: 'member name is required' })
    let week: string | undefined
    if (typeof args.week === 'string' && args.week.trim()) {
      try {
        week = mondayOf(args.week.trim())
      } catch {
        return JSON.stringify({ error: `invalid week date: ${args.week}` })
      }
    }
    const rows = await fetchReportRows(windowStartOf(DETAIL_WINDOW_WEEKS))
    const row = findReportDetail(rows, member, week)
    if (!row) {
      return JSON.stringify({ error: week ? `no submitted report for ${member} in week ${week}` : `no submitted report found for ${member}` })
    }
    return JSON.stringify({
      member,
      week: row.weekStart,
      status: row.status,
      project: row.projectName,
      tasks: row.tasks,
      nextWeekTasks: row.nextWeekTasks,
      blockers: row.blockers,
      achievements: row.achievements,
      notes: row.notes,
    })
  },
}

export const aiTools: ToolDef[] = [projectHoursTool, memberPerformanceTool, reportDetailTool]
