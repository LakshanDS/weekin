import { eq } from 'drizzle-orm'
import { projects } from '../../database/schema'
import { z } from 'zod'

const projectSchema = z.object({
  name: z.string().min(2, 'Name is required').max(120),
  description: z.string().max(500).nullable().optional(),
})

// POST /api/projects — create (manager only)
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const body = await validateBody(event, projectSchema)
  const database = useDatabase()

  const [existing] = await database.select({ id: projects.id }).from(projects).where(eq(projects.name, body.name))
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'A project with this name already exists' })
  }

  const [project] = await database
    .insert(projects)
    .values({ name: body.name, description: body.description ?? null })
    .returning()
  setResponseStatus(event, 201)
  return { project }
})
