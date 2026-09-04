import { eq } from 'drizzle-orm'
import { reports } from '../../../database/schema'
import { loadReportFor } from '../../../utils/reports'

// DELETE /api/reports/:id — owner deletes a report that isn't under review.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { database, report } = await loadReportFor(event, Number(id))

  if (report.status === 'SUBMITTED' || report.status === 'APPROVED') {
    throw createError({ statusCode: 409, statusMessage: 'Submitted or approved reports cannot be deleted' })
  }

  await database.delete(reports).where(eq(reports.id, report.id))
  return { ok: true }
})
