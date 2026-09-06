import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { updateProfileSchema } from '#shared/schemas/auth'
import { requireUser } from '../../utils/auth'

// PUT /api/auth/profile — update the signed-in user's own profile
export default defineEventHandler(async (event) => {
  const session = requireUser(event)
  const body = await validateBody(event, updateProfileSchema)
  const database = useDatabase()

  const [user] = await database
    .update(users)
    .set({ name: body.name })
    .where(eq(users.id, session.id))
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })

  return { user }
})
