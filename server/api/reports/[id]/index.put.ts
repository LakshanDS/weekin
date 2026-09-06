import { updateReportContentSchema } from '#shared/schemas/report'
import { loadReportFor, saveContent, validateAssignedManager } from '../../../utils/reports'

// PUT /api/reports/:id — owner edits content while DRAFT or NEEDS_CORRECTION.
// Managers can never rewrite report content.
export default defineEventHandler(async (event) => {
  const { session, database, report } = await loadReportFor(event, parseIdParam(event))

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
  await validateAssignedManager(database, body.assignedManagerId)
  const versionId = await saveContent(database, report.id, body.projectId, body.assignedManagerId, body.content)
  return { ok: true, versionId }
})
