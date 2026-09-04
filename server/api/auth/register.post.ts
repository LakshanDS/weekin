import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import { registerSchema } from '#shared/schemas/auth'
import { hashPassword, setSessionCookie } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await validateBody(event, registerSchema)
  const db = useDb()
  const email = body.email.toLowerCase()

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }

  const [user] = await db
    .insert(users)
    .values({
      name: body.name,
      email,
      passwordHash: await hashPassword(body.password),
      role: 'MEMBER',
    })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role })

  await setSessionCookie(event, { id: user.id, role: user.role })
  setResponseStatus(event, 201)
  return { user }
})
