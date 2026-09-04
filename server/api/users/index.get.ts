import { asc } from 'drizzle-orm'
import { users } from '../../database/schema'

// GET /api/users — full user list (manager only)
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const database = useDatabase()
  return {
    users: await database
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
      .from(users)
      .orderBy(asc(users.id)),
  }
})
