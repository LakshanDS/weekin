import { eq } from 'drizzle-orm'
import { projects } from '../../../database/schema'
import { z } from 'zod'

const projectSchema = z.object({
  name: z.string().min(2, 'Name is required').max(120),
  description: z.string().max(500).nullable().optional(),
})

// PUT /api/projects/:id — rename / edit description (manager only)
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await validateBody(event, projectSchema)
  const database = useDatabase()

  const [existing] = await database.select({ id: projects.id }).from(projects).where(eq(projects.id, id))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  const [duplicate] = await database.select({ id: projects.id }).from(projects).where(eq(projects.name, body.name))
  if (duplicate && duplicate.id !== id) {
    throw createError({ statusCode: 409, statusMessage: 'A project with this name already exists' })
  }

  const [project] = await database
    .update(projects)
    .set({ name: body.name, description: body.description ?? null })
    .where(eq(projects.id, id))
    .returning()
  return { project }
})
