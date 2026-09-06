import { asc, eq } from 'drizzle-orm'
import { reportVersions, reviewComments, users } from '../../../database/schema'
import { loadReportFor, getVisibleVersion } from '../../../utils/reports'

// GET /api/reports/:id — full detail: content under review (or the owner's
// draft-in-progress), review comments, and version metadata.
export default defineEventHandler(async (event) => {
  const { database, report, isOwner } = await loadReportFor(event, parseIdParam(event))

  const version = await getVisibleVersion(database, report.id, isOwner)

  const comments = await database
    .select({
      id: reviewComments.id,
      action: reviewComments.action,
      comment: reviewComments.comment,
      createdAt: reviewComments.createdAt,
      versionNo: reportVersions.versionNo,
      managerName: users.name,
    })
    .from(reviewComments)
    .innerJoin(users, eq(users.id, reviewComments.managerId))
    .innerJoin(reportVersions, eq(reportVersions.id, reviewComments.versionId))
    .where(eq(reviewComments.reportId, report.id))
    .orderBy(asc(reviewComments.createdAt))

  const versions = await database
    .select({
      id: reportVersions.id,
      versionNo: reportVersions.versionNo,
      submittedAt: reportVersions.submittedAt,
      createdAt: reportVersions.createdAt,
    })
    .from(reportVersions)
    .where(eq(reportVersions.reportId, report.id))
    .orderBy(asc(reportVersions.versionNo))

  return {
    report,
    content: version
      ? {
          versionId: version.id,
          versionNo: version.versionNo,
          isDraftContent: version.submittedAt === null,
          tasks: version.tasks,
          nextWeekTasks: version.nextWeekTasks,
          blockers: version.blockers,
          achievements: version.achievements,
          hoursByType: version.hoursByType,
          notes: version.notes,
        }
      : null,
    comments,
    versions,
  }
})
