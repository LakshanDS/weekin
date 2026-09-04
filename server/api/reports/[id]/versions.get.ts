import { asc, eq } from 'drizzle-orm'
import { reportVersions } from '../../../database/schema'
import { loadReportFor } from '../../../utils/reports'

// GET /api/reports/:id/versions — past versions of this report.
// Managers see submitted versions only; the owner also sees draft-in-progress.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { database, isOwner } = await loadReportFor(event, Number(id))

  const rows = await database
    .select()
    .from(reportVersions)
    .where(eq(reportVersions.reportId, Number(id)))
    .orderBy(asc(reportVersions.versionNo))

  return {
    versions: isOwner ? rows : rows.filter((v) => v.submittedAt !== null),
  }
})
