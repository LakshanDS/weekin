import { asc } from 'drizzle-orm'
import { projects } from '../../database/schema'

// GET /api/projects — list all (full CRUD lives in Day 3's management page)
export default defineEventHandler(async (event) => {
  requireUser(event)
  const database = useDatabase()
  return { projects: await database.select().from(projects).orderBy(asc(projects.name)) }
})
