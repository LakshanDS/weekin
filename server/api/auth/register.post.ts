import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { registerSchema } from '#shared/schemas/auth'
import { hashPassword, setSessionCookie } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  rateLimit(`register:${clientIp(event)}`, 10, 5 * 60_000)
  const body = await validateBody(event, registerSchema)
  const database = useDatabase()
  const email = body.email.toLowerCase()

  const [existing] = await database.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }

  const [user] = await database
    .insert(users)
    .values({
      name: body.name,
      email,
      passwordHash: await hashPassword(body.password),
      role: 'MEMBER',
      status: 'PENDING',
    })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })

  await setSessionCookie(event, { id: user.id, role: user.role })
  setResponseStatus(event, 201)
  return { user }
})
