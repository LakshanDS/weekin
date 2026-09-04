import { updateReportContentSchema } from '#shared/schemas/report'
import { loadReportFor, saveContent } from '../../../utils/reports'

// PUT /api/reports/:id — owner edits content while DRAFT or NEEDS_CORRECTION.
// Managers can never rewrite report content.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { session, database, report } = await loadReportFor(event, Number(id))

  if (session.role === 'MANAGER' && report.userId !== session.id) {
    throw createError({ statusCode: 403, statusMessage: 'Managers cannot edit report content' })
  }
  if (report.status !== 'DRAFT' && report.status !== 'NEEDS_CORRECTION') {
    throw createError({
      statusCode: 409,
      statusMessage: report.status === 'SUBMITTED'
        ? 'Report is awaiting review'
        : 'Approved reports can no longer be edited',
    })
  }

  const body = await validateBody(event, updateReportContentSchema)
  const versionId = await saveContent(database, report.id, body.projectId, body.content)
  return { ok: true, versionId }
})
