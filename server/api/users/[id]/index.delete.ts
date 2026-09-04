import { eq } from 'drizzle-orm'
import { users } from '../../../database/schema'

// DELETE /api/users/:id — remove a team member and their reports (manager only)
export default defineEventHandler(async (event) => {
  const session = await requireManager(event)
  const id = Number(getRouterParam(event, 'id'))
  const database = useDatabase()

  if (session.id === id) {
    throw createError({ statusCode: 409, statusMessage: 'You cannot remove your own account' })
  }

  const [user] = await database.select({ id: users.id }).from(users).where(eq(users.id, id))
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Reports and memberships cascade via FK constraints
  await database.delete(users).where(eq(users.id, id))
  return { ok: true }
})
