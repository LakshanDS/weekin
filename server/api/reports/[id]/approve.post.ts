import { eq } from 'drizzle-orm'
import { reports, reviewComments } from '../../../database/schema'
import { approveReportSchema } from '#shared/schemas/report'
import { loadReportFor, getVisibleVersion } from '../../../utils/reports'

// POST /api/reports/:id/approve — manager approves the version under review.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { session, database, report } = await loadReportFor(event, Number(id))

  requireManager(event)
  if (session.id === report.userId) {
    throw createError({ statusCode: 409, statusMessage: 'Managers cannot review their own reports' })
  }
  if (report.status !== 'SUBMITTED') {
    throw createError({ statusCode: 409, statusMessage: 'Only submitted reports can be approved' })
  }

  const body = await validateBody(event, approveReportSchema)
  const version = await getVisibleVersion(database, report.id, false)
  const now = new Date()

  await database.transaction(async (tx) => {
    if (body.comment) {
      await tx.insert(reviewComments).values({
        reportId: report.id,
        versionId: version!.id,
        managerId: session.id,
        action: 'APPROVE',
        comment: body.comment,
      })
    }
    await tx
      .update(reports)
      .set({ status: 'APPROVED', reviewedAt: now, updatedAt: now })
      .where(eq(reports.id, report.id))
  })

  return { ok: true, status: 'APPROVED' }
})
