import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import { loginSchema } from '#shared/schemas/auth'
import { verifyPassword, setSessionCookie } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await validateBody(event, loginSchema)
  const db = useDb()

  const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase()))
  // Same generic message for unknown email and wrong password.
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await setSessionCookie(event, { id: user.id, role: user.role })
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role } }
})
