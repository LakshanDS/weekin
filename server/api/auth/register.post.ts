import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { registerSchema } from '#shared/schemas/auth'
import { hashPassword, setSessionCookie } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  rateLimit(`register:${clientIp(event)}`, 15, 60_000)
  const body = await validateBody(event, registerSchema)
  const database = useDatabase()
  const email = body.email.toLowerCase()

  const [existing] = await database.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }

  try {
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

    await setSessionCookie(event, { id: user.id, role: user.role, status: user.status })
    setResponseStatus(event, 201)
    return { user }
  } catch (err) {
    // Concurrent registration beat the pre-check to the unique constraint.
    if ((err as { code?: string }).code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
    }
    throw err
  }
})
