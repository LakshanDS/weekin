import { and, eq, inArray } from 'drizzle-orm'
import { reports } from '../../../database/schema'
import { loadReportFor } from '../../../utils/reports'

// DELETE /api/reports/:id — owners may delete their drafts/corrections;
// managers may remove any report (moderation).
export default defineEventHandler(async (event) => {
  const { session, database, report, isOwner } = await loadReportFor(event, parseIdParam(event))

  if (isOwner) {
    if (report.status === 'SUBMITTED' || report.status === 'APPROVED') {
      throw createError({ statusCode: 409, statusMessage: 'Submitted or approved reports cannot be deleted' })
    }
    // Conditional delete: a submit/approve landing between the status read and
    // here must win — 0 rows means the report was frozen and we refuse.
    const deleted = await database
      .delete(reports)
      .where(and(eq(reports.id, report.id), inArray(reports.status, ['DRAFT', 'NEEDS_CORRECTION'])))
      .returning({ id: reports.id })
    if (deleted.length === 0) {
      throw createError({ statusCode: 409, statusMessage: 'Submitted or approved reports cannot be deleted' })
    }
    return { ok: true }
  } else if (session.role !== 'MANAGER') {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  await database.delete(reports).where(eq(reports.id, report.id))
  return { ok: true }
})
