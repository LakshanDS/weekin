import { asc, eq, and } from 'drizzle-orm'
import { users } from '../../database/schema'

// GET /api/users/managers — active managers for the assigned-manager picker (names only).
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const database = useDatabase(event)
  return {
    managers: await database
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, 'MANAGER'), eq(users.status, 'ACTIVE')))
      .orderBy(asc(users.name)),
  }
})
