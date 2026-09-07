import { and, eq } from 'drizzle-orm'
import { projectMembers } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = parseIdParam(event)
  const userId = Number(getRouterParam(event, 'userId'))
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const database = useDatabase(event)

  const removed = await database
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)))
    .returning({ id: projectMembers.id })
  if (removed.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Membership not found' })
  }
  return { ok: true }
})
