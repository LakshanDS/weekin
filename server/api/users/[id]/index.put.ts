import { count, eq } from 'drizzle-orm'
import { users } from '../../../database/schema'
import { z } from 'zod'

const updateSchema = z
  .object({
    role: z.enum(['MEMBER', 'MANAGER']).optional(),
    // Approval only goes one way: PENDING accounts become ACTIVE
    status: z.literal('ACTIVE').optional(),
  })
  .refine((body) => body.role !== undefined || body.status !== undefined, { message: 'Nothing to update' })

// PUT /api/users/:id — change a user's role and/or approve them (manager only)
export default defineEventHandler(async (event) => {
  const session = await requireManager(event)
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

  const patch: Partial<Pick<typeof users.$inferSelect, 'role' | 'status'>> = {}
  if (body.role !== undefined) patch.role = body.role
  if (body.status !== undefined) patch.status = body.status

  const [updated] = await database.update(users).set(patch).where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })
  return { user: updated }
})
