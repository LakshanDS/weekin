import { count, eq } from 'drizzle-orm'
import { users } from '../../../database/schema'
import { z } from 'zod'

const updateSchema = z.object({
  role: z.enum(['MEMBER', 'MANAGER']),
})

// PUT /api/users/:id — change a user's role (manager only)
export default defineEventHandler(async (event) => {
  const session = requireManager(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await validateBody(event, updateSchema)
  const database = useDatabase()

  const [user] = await database.select({ id: users.id }).from(users).where(eq(users.id, id))
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Don't let the last manager demote themselves and lock the team out of admin
  if (session.id === id && body.role === 'MEMBER') {
    const [{ value: managerCount }] = await database.select({ value: count() }).from(users).where(eq(users.role, 'MANAGER'))
    if (managerCount <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'You are the only manager — promote someone else first' })
    }
  }

  const [updated] = await database.update(users).set({ role: body.role }).where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role })
  return { user: updated }
})
