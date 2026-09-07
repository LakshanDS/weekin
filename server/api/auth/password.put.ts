import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { changePasswordSchema } from '#shared/schemas/auth'
import { hashPassword, verifyPassword, requireUser } from '../../utils/auth'

// PUT /api/auth/password — change the signed-in user's own password
export default defineEventHandler(async (event) => {
  const session = requireUser(event)
  rateLimit(`password:${session.id}`, 15, 60_000)
  const body = await validateBody(event, changePasswordSchema)
  const database = useDatabase()

  const [user] = await database
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.id))
  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })
  }

  await database
    .update(users)
    .set({ passwordHash: await hashPassword(body.newPassword) })
    .where(eq(users.id, session.id))

  return { ok: true }
})
