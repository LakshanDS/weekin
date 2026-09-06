import { asc, count, eq } from 'drizzle-orm'
import { projects, reports } from '../../database/schema'

// GET /api/projects — list all with how many reports use each one
export default defineEventHandler(async (event) => {
  requireUser(event)
  const database = useDatabase()
  const rows = await database
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      reportCount: count(reports.id),
    })
    .from(projects)
    .leftJoin(reports, eq(reports.projectId, projects.id))
    .groupBy(projects.id)
    .orderBy(asc(projects.name))
  return { projects: rows }
})
