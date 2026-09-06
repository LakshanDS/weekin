import { and, count, eq, sql } from 'drizzle-orm'
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
  const id = parseIdParam(event)
  const body = await validateBody(event, updateSchema)
  const database = useDatabase(event)

  const [user] = await database.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, id))
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const demoting = body.role === 'MEMBER' && user.role === 'MANAGER'
  // Friendly pre-check for the common case; the guarded update below is the real guard.
  if (demoting && session.id === id) {
    const [{ value: managerCount }] = await database.select({ value: count() }).from(users).where(eq(users.role, 'MANAGER'))
    if (managerCount <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'You are the only manager — promote someone else first' })
    }
  }

  const patch: Partial<Pick<typeof users.$inferSelect, 'role' | 'status'>> = {}
  if (body.role !== undefined) patch.role = body.role
  if (body.status !== undefined) patch.status = body.status

  // Demotion is a single guarded statement: the WHERE re-counts managers, so two
  // concurrent demotions can't both succeed and leave the team without one.
  const [updated] = await database
    .update(users)
    .set(patch)
    .where(
      demoting
        ? and(eq(users.id, id), sql`(select count(*) from ${users} where ${users.role} = 'MANAGER') > 1`)
        : eq(users.id, id),
    )
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })

  if (!updated) {
    // 0 rows: either the last-manager guard tripped, or the user vanished mid-flight.
    if (demoting) {
      throw createError({
        statusCode: 409,
        statusMessage:
          session.id === id
            ? 'You are the only manager — promote someone else first'
            : 'The last manager cannot be demoted — promote someone else first',
      })
    }
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  return { user: updated }
})
