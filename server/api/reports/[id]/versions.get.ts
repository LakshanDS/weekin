import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { reportVersions } from '../../../database/schema'
import { loadReportFor } from '../../../utils/reports'

// GET /api/reports/:id/versions — past versions of this report.
// Managers see submitted versions only; the owner also sees draft-in-progress.
export default defineEventHandler(async (event) => {
  const id = parseIdParam(event)
  const { database, isOwner } = await loadReportFor(event, id)

  // Visibility rule in SQL; metadata columns only — JSONB content stays out.
  const versions = await database
    .select({
      id: reportVersions.id,
      versionNo: reportVersions.versionNo,
      submittedAt: reportVersions.submittedAt,
      createdAt: reportVersions.createdAt,
    })
    .from(reportVersions)
    .where(isOwner ? eq(reportVersions.reportId, id) : and(eq(reportVersions.reportId, id), isNotNull(reportVersions.submittedAt)))
    .orderBy(asc(reportVersions.versionNo))

  return { versions }
})
