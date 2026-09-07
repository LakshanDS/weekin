import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { loginSchema } from '#shared/schemas/auth'
import { verifyPassword, setSessionCookie } from '../../utils/auth'

// Burn a bcrypt compare for unknown emails so response timing can't reveal
// whether the address is registered.
const DUMMY_HASH = '$2b$10$hCXZ1SzBokBQl78czS60dOOG/5soMIyZdTLO19.A6f0kl34xNI0iq'

export default defineEventHandler(async (event) => {
  rateLimit(`login:${clientIp(event)}`, 15, 60_000)
  const body = await validateBody(event, loginSchema)
  const database = useDatabase()

  const [user] = await database.select().from(users).where(eq(users.email, body.email.toLowerCase()))
  // Same generic message for unknown email and wrong password.
  if (!user) {
    await verifyPassword(body.password, DUMMY_HASH)
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }
  if (!(await verifyPassword(body.password, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await setSessionCookie(event, { id: user.id, role: user.role })
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status } }
})
