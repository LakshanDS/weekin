import { eq } from 'drizzle-orm'
import { reports } from '../../../database/schema'
import { loadReportFor } from '../../../utils/reports'

// DELETE /api/reports/:id — owners may delete their drafts/corrections;
// managers may remove any report (moderation).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { session, database, report, isOwner } = await loadReportFor(event, Number(id))

  if (isOwner) {
    if (report.status === 'SUBMITTED' || report.status === 'APPROVED') {
      throw createError({ statusCode: 409, statusMessage: 'Submitted or approved reports cannot be deleted' })
    }
  } else if (session.role !== 'MANAGER') {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  await database.delete(reports).where(eq(reports.id, report.id))
  return { ok: true }
})
