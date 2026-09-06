import { asc, eq, and } from 'drizzle-orm'
import { users } from '../../database/schema'

// GET /api/users/managers — active managers, for the report's assigned-manager
// picker. Any signed-in member can list them (names only, no emails).
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const database = useDatabase()
  return {
    managers: await database
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, 'MANAGER'), eq(users.status, 'ACTIVE')))
      .orderBy(asc(users.name)),
  }
})
