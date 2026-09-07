import { asc, count, eq } from 'drizzle-orm'
import { projectMembers, projects, reports, users } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = parseIdParam(event)
  const database = useDatabase(event)

  const [project] = await database
    .select({ id: projects.id, name: projects.name, description: projects.description, createdAt: projects.createdAt })
    .from(projects)
    .where(eq(projects.id, id))
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  const members = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, id))
    .orderBy(asc(users.name))

  const [{ value: reportCount }] = await database
    .select({ value: count() })
    .from(reports)
    .where(eq(reports.projectId, id))

  return { project, members, reportCount }
})
