import { and, eq } from 'drizzle-orm'
import { reports, reportVersions, projects } from '../../database/schema'
import { createReportSchema } from '#shared/schemas/report'
import { addDaysIso, mondayOf } from '#shared/utils/week'
import { validateAssignedManager } from '../../utils/reports'

// POST /api/reports — create a draft with its first (unsubmitted) version.
export default defineEventHandler(async (event) => {
  const session = requireUser(event)
  const body = await validateBody(event, createReportSchema)
  const database = useDatabase()

  if (body.projectId) {
    const [project] = await database
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, body.projectId))
    if (!project) {
      throw createError({ statusCode: 422, statusMessage: 'Unknown project' })
    }
  }
  await validateAssignedManager(database, body.assignedManagerId)

  // Weeks are normalised server-side: always Monday..Friday, so team views
  // and the one-report-per-week rule can't be dodged with custom dates.
  const weekStart = mondayOf(body.weekStart)
  const weekEnd = addDaysIso(weekStart, 4)

  const [existing] = await database
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.userId, session.id), eq(reports.weekStart, weekStart)))
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'You already have a report for this week' })
  }

  const report = await database.transaction(async (tx) => {
    const [created] = await tx
      .insert(reports)
      .values({
        userId: session.id,
        projectId: body.projectId,
        assignedManagerId: body.assignedManagerId,
        weekStart,
        weekEnd,
        status: 'DRAFT',
      })
      .returning()
    await tx.insert(reportVersions).values({
      reportId: created.id,
      versionNo: 1,
      ...body.content,
    })
    return created
  })

  setResponseStatus(event, 201)
  return { report }
})
