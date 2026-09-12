import { and, asc, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm'
import { projects, reports, reportVersions, users } from '../../../database/schema'

// GET /api/team/:id — one member's profile: basic stats + report history (manager only)
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = parseIdParam(event)
  const database = useDatabase(event)

  const [member] = await database
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, id))
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const history = await database
    .select({
      id: reports.id,
      weekStart: reports.weekStart,
      weekEnd: reports.weekEnd,
      status: reports.status,
      submittedAt: reports.submittedAt,
      projectName: projects.name,
    })
    .from(reports)
    .leftJoin(projects, eq(projects.id, reports.projectId))
    .where(and(eq(reports.userId, id), ne(reports.status, 'DRAFT')))
    .orderBy(desc(reports.weekStart))

  // Content stats over each report's latest submitted version, fetched in SQL —
  // only the columns we aggregate cross the wire, not every version's JSONB.
  const versions = history.length
    ? await database
        .selectDistinctOn([reportVersions.reportId], {
          reportId: reportVersions.reportId,
          tasks: reportVersions.tasks,
          hoursByType: reportVersions.hoursByType,
        })
        .from(reportVersions)
        .where(and(inArray(reportVersions.reportId, history.map((r) => r.id)), isNotNull(reportVersions.submittedAt)))
        .orderBy(asc(reportVersions.reportId), desc(reportVersions.versionNo))
    : []
  const latestSubmitted = new Map(versions.map((v) => [v.reportId, v]))

  const stats = {
    totalReports: history.length,
    approved: history.filter((r) => r.status === 'APPROVED').length,
    needsCorrection: history.filter((r) => r.status === 'NEEDS_CORRECTION').length,
    pending: history.filter((r) => r.status === 'SUBMITTED').length,
    tasksDone: [...latestSubmitted.values()].reduce(
      (sum, v) => sum + v.tasks.filter((t) => t.status === 'DONE').length, 0),
    hoursLogged: Math.round(
      [...latestSubmitted.values()].reduce(
        (sum, v) => sum + Object.values(v.hoursByType ?? {}).reduce((a, b) => a + (b ?? 0), 0), 0) * 10,
    ) / 10,
    onTime: history.filter((r) => r.submittedAt && r.submittedAt <= new Date(`${r.weekEnd}T23:59:59Z`)).length,
  }

  return { member, stats, history }
})
