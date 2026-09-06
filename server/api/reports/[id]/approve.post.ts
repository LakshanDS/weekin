import { and, eq } from 'drizzle-orm'
import { reports, reviewComments } from '../../../database/schema'
import { approveReportSchema } from '#shared/schemas/report'
import { loadReportFor, getVisibleVersion } from '../../../utils/reports'

// POST /api/reports/:id/approve — manager approves the version under review.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { session, database, report } = await loadReportFor(event, Number(id))

  await requireManager(event)
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
    // Claim the transition: fails if a concurrent review already moved it.
    const claimed = await tx
      .update(reports)
      .set({ status: 'APPROVED', reviewedAt: now, updatedAt: now })
      .where(and(eq(reports.id, report.id), eq(reports.status, 'SUBMITTED')))
      .returning({ id: reports.id })
    if (claimed.length === 0) {
      throw createError({ statusCode: 409, statusMessage: 'Report is no longer awaiting review' })
    }
    // Always record the approval so the timeline shows it, even without a message.
    await tx.insert(reviewComments).values({
      reportId: report.id,
      versionId: version!.id,
      managerId: session.id,
      action: 'APPROVE',
      comment: body.comment ?? null,
    })
  })

  return { ok: true, status: 'APPROVED' }
})
