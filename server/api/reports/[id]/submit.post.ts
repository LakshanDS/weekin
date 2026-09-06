import { and, eq, inArray } from 'drizzle-orm'
import { reports, reportVersions } from '../../../database/schema'
import { loadReportFor, getLatestVersion } from '../../../utils/reports'

// POST /api/reports/:id/submit — owner submits for review.
// Freezes the current content as the version under review.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { session, database, report } = await loadReportFor(event, Number(id))

  // Only the owner submits: a manager force-submitting would freeze the report
  // and lock the member out. Same 404 as cross-user reads (no existence leak).
  if (report.userId !== session.id) {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  if (report.status !== 'DRAFT' && report.status !== 'NEEDS_CORRECTION') {
    throw createError({ statusCode: 409, statusMessage: 'Only a draft or corrected report can be submitted' })
  }

  const latest = await getLatestVersion(database, report.id)
  if (!latest || latest.tasks.length === 0) {
    throw createError({ statusCode: 422, statusMessage: 'Add at least one task before submitting' })
  }

  const now = new Date()
  await database.transaction(async (tx) => {
    // Claim the transition first: blocks double-submit and submit racing a review.
    const claimed = await tx
      .update(reports)
      .set({ status: 'SUBMITTED', submittedAt: now, updatedAt: now })
      .where(and(eq(reports.id, report.id), inArray(reports.status, ['DRAFT', 'NEEDS_CORRECTION'])))
      .returning({ id: reports.id })
    if (claimed.length === 0) {
      throw createError({ statusCode: 409, statusMessage: 'Only a draft or corrected report can be submitted' })
    }
    if (latest.submittedAt === null) {
      await tx.update(reportVersions).set({ submittedAt: now }).where(eq(reportVersions.id, latest.id))
    } else {
      // Resubmitted without edits: snapshot the reviewed content as a new version
      const { id: _omit, reportId: _r, versionNo: _v, submittedAt: _s, createdAt: _c, ...content } = latest
      await tx.insert(reportVersions).values({
        reportId: report.id,
        versionNo: latest.versionNo + 1,
        ...content,
        submittedAt: now,
      })
    }
  })

  return { ok: true, status: 'SUBMITTED' }
})
