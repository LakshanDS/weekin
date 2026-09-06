import { and, eq, gte, inArray, isNotNull, lte, ne } from 'drizzle-orm'
import { reports, reportVersions, users, projects } from '../../database/schema'

// GET /api/team/week?week=YYYY-MM-DD — every member's report for one week,
// with the key blocker / key achievement for the side-by-side view (manager only).
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const query = getQuery(event)
  const weekParam = typeof query.week === 'string' ? query.week : undefined
  const weekStart = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? mondayOf(weekParam) : mondayOf(new Date().toISOString().slice(0, 10))
  const database = useDatabase()

  const members = await database.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, 'MEMBER')).orderBy(users.name)

  const weekReports = await database
    .select({
      id: reports.id,
      userId: reports.userId,
      projectName: projects.name,
      status: reports.status,
      submittedAt: reports.submittedAt,
    })
    .from(reports)
    .leftJoin(projects, eq(projects.id, reports.projectId))
    .where(and(eq(reports.weekStart, weekStart), inArray(reports.userId, members.map((m) => m.id)), ne(reports.status, 'DRAFT')))

  const versions = weekReports.length
    ? await database
        .select({
          reportId: reportVersions.reportId,
          versionNo: reportVersions.versionNo,
          blockers: reportVersions.blockers,
          achievements: reportVersions.achievements,
        })
        .from(reportVersions)
        .where(and(inArray(reportVersions.reportId, weekReports.map((r) => r.id)), isNotNull(reportVersions.submittedAt)))
    : []
  const latest = new Map<number, (typeof versions)[number]>()
  for (const version of versions.sort((a, b) => b.versionNo - a.versionNo)) {
    if (!latest.has(version.reportId)) latest.set(version.reportId, version)
  }

  return {
    weekStart,
    members: members.map((m) => {
      const report = weekReports.find((r) => r.userId === m.id)
      const content = report ? latest.get(report.id) : undefined
      return {
        userId: m.id,
        name: m.name,
        report: report
          ? {
              id: report.id,
              status: report.status,
              projectName: report.projectName,
              submittedAt: report.submittedAt,
              keyBlocker: content?.blockers.find((b) => b.isKey)?.text ?? content?.blockers[0]?.text ?? null,
              keyAchievement: content?.achievements.find((a) => a.isKey)?.text ?? content?.achievements[0]?.text ?? null,
            }
          : null,
      }
    }),
  }
})
