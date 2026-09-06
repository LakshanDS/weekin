import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { reportVersions } from '../../../database/schema'
import { loadReportFor } from '../../../utils/reports'

// GET /api/reports/:id/versions — past versions of this report.
// Managers see submitted versions only; the owner also sees draft-in-progress.
export default defineEventHandler(async (event) => {
  const id = parseIdParam(event)
  const { database, isOwner } = await loadReportFor(event, id)

  // Visibility rule in SQL. Full rows: the report page renders each version's
  // content in its timeline, so the JSONB columns are part of the contract.
  const versions = await database
    .select()
    .from(reportVersions)
    .where(isOwner ? eq(reportVersions.reportId, id) : and(eq(reportVersions.reportId, id), isNotNull(reportVersions.submittedAt)))
    .orderBy(asc(reportVersions.versionNo))

  return { versions }
})
