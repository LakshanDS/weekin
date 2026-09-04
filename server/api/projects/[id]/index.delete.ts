import { eq } from 'drizzle-orm'
import { projects } from '../../../database/schema'

// DELETE /api/projects/:id — reports keep their history, project reference is cleared (manager only)
export default defineEventHandler(async (event) => {
  requireManager(event)
  const id = Number(getRouterParam(event, 'id'))
  const database = useDatabase()

  const [existing] = await database.select({ id: projects.id }).from(projects).where(eq(projects.id, id))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  await database.delete(projects).where(eq(projects.id, id))
  return { ok: true }
})
