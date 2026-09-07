import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { projectMembers, projects, users } from '../../../../database/schema'

const memberSchema = z.object({ userId: z.number().int().positive() })

// POST /api/projects/:id/members — assign a user to the project (manager only)
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = parseIdParam(event)
  const body = await validateBody(event, memberSchema)
  const database = useDatabase(event)

  const [project] = await database.select({ id: projects.id }).from(projects).where(eq(projects.id, id))
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }
  const [user] = await database.select({ id: users.id }).from(users).where(eq(users.id, body.userId))
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  let membership
  try {
    const [created] = await database
      .insert(projectMembers)
      .values({ projectId: id, userId: body.userId })
      .returning()
    membership = created
  } catch (error) {
    // 23505: the (project, user) pair already exists — raced past or duplicate.
    if ((error as { code?: string }).code !== '23505') throw error
    throw createError({ statusCode: 409, statusMessage: 'User is already assigned to this project' })
  }
  setResponseStatus(event, 201)
  return { membership }
})
