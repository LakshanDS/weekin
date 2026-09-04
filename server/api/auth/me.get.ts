import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = requireUser(event)
  const db = useDb()

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, session.id))

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Account no longer exists' })
  }
  return { user }
})
