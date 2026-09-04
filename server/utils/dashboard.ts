import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm'
import { reports, reportVersions, reviewComments, users, projects } from '../database/schema'
import { addDaysIso, mondayOf } from '#shared/utils/week'

// Aggregations for the manager dashboard. Data volume is small (internal team),
// so we pull the window's rows once and aggregate in JS — easy to read, easy to test.
export async function getDashboardData(selectedWeekStart: string, windowWeeks = 8) {
  const database = useDatabase()
  const weekEnd = addDaysIso(selectedWeekStart, 4)
  const windowStart = addDaysIso(mondayOf(selectedWeekStart), -7 * (windowWeeks - 1))

  const members = await database.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, 'MEMBER'))
  const memberIds = members.map((m) => m.id)

  const windowReports = await database
    .select({
      id: reports.id,
      userId: reports.userId,
      userName: users.name,
      projectId: reports.projectId,
      projectName: projects.name,
      weekStart: reports.weekStart,
      status: reports.status,
      submittedAt: reports.submittedAt,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.userId))
    .leftJoin(projects, eq(projects.id, reports.projectId))
    .where(and(gte(reports.weekStart, windowStart), lte(reports.weekStart, selectedWeekStart)))
    .orderBy(asc(reports.weekStart))

  // Latest submitted version per report (drafts-in-progress are not team data yet)
  const reportIds = windowReports.map((r) => r.id)
  const versions = reportIds.length
    ? await database
        .select()
        .from(reportVersions)
        .where(and(inArray(reportVersions.reportId, reportIds), isNotNull(reportVersions.submittedAt)))
        .orderBy(desc(reportVersions.versionNo))
    : []
  const latestSubmitted = new Map<number, (typeof versions)[number]>()
  for (const version of versions) {
    if (!latestSubmitted.has(version.reportId)) latestSubmitted.set(version.reportId, version)
  }

  // --- week summary ---
  const weekReports = windowReports.filter((r) => r.weekStart === selectedWeekStart)
  const statusCount = (status: string) => weekReports.filter((r) => r.status === status).length
  // Anyone who submitted on time is compliant — even if the report was sent back.
  const submitted = weekReports.filter((r) => r.status !== 'DRAFT' && r.submittedAt)
  const late = submitted.filter((r) => r.submittedAt! > new Date(`${weekEnd}T23:59:59Z`)).length
  const onTime = submitted.length - late
  const pending = memberIds.length - submitted.length

  // Open = the report still awaits approval (submitted or sent back)
  const openBlockers = windowReports
    .filter((r) => r.status === 'SUBMITTED' || r.status === 'NEEDS_CORRECTION')
    .reduce((sum, r) => sum + (latestSubmitted.get(r.id)?.blockers.length ?? 0), 0)

  const summary = {
    weekStart: selectedWeekStart,
    totalSubmitted: statusCount('SUBMITTED'),
    approved: statusCount('APPROVED'),
    needsCorrection: statusCount('NEEDS_CORRECTION'),
    openBlockers,
    compliance: { onTime: Math.max(0, onTime), late, pending, totalMembers: memberIds.length },
  }

  // --- charts ---
  const weeks: string[] = []
  for (let i = 0; i < windowWeeks; i++) weeks.push(addDaysIso(windowStart, 7 * i))

  const tasksDoneTrend = weeks.map((week) => {
    const done = windowReports
      .filter((r) => r.weekStart === week)
      .reduce((sum, r) => sum + (latestSubmitted.get(r.id)?.tasks.filter((t) => t.status === 'DONE').length ?? 0), 0)
    return { week, done }
  })

  const statusByMember = members.map((m) => {
    const counts = { DRAFT: 0, SUBMITTED: 0, NEEDS_CORRECTION: 0, APPROVED: 0 }
    for (const report of windowReports.filter((r) => r.userId === m.id)) {
      counts[report.status]++
    }
    return { name: m.name, ...counts }
  })

  const hoursByProject = new Map<string, number>()
  const hoursByType = { development: 0, testing: 0, meetings: 0, documentation: 0 }
  for (const report of windowReports) {
    const version = latestSubmitted.get(report.id)
    if (!version) continue
    const key = report.projectName ?? 'No project'
    hoursByProject.set(key, (hoursByProject.get(key) ?? 0) + Object.values(version.hoursByType ?? {}).reduce((a, b) => a + (b ?? 0), 0))
    for (const [type, value] of Object.entries(version.hoursByType ?? {})) {
      hoursByType[type as keyof typeof hoursByType] += value ?? 0
    }
  }

  // --- activity feed: submissions + review actions, newest first ---
  const submissions = windowReports
    .filter((r) => r.submittedAt)
    .map((r) => ({ type: 'submitted' as const, at: r.submittedAt!, text: `${r.userName} submitted ${r.weekStart}`, reportId: r.id }))
  const reviews = await database
    .select({
      action: reviewComments.action,
      comment: reviewComments.comment,
      createdAt: reviewComments.createdAt,
      managerName: users.name,
      reportId: reviewComments.reportId,
    })
    .from(reviewComments)
    .innerJoin(users, eq(users.id, reviewComments.managerId))
    .orderBy(desc(reviewComments.createdAt))
    .limit(8)
  const activity = [
    ...submissions.slice(-8),
    ...reviews.map((r) => ({
      type: r.action === 'APPROVE' ? ('approved' as const) : ('sent_back' as const),
      at: r.createdAt,
      text: `${r.managerName} ${r.action === 'APPROVE' ? 'approved' : 'sent back'} a report${r.comment ? `: “${r.comment}”` : ''}`,
      reportId: r.reportId,
    })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 10)

  return {
    summary,
    charts: {
      weeks,
      tasksDoneTrend,
      statusByMember,
      hoursByProject: [...hoursByProject.entries()].map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 })),
      hoursByType: Object.fromEntries(Object.entries(hoursByType).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    },
    activity,
  }
}
