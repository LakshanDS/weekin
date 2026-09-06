import { eq } from 'drizzle-orm'
import { users } from '../database/schema'
import { useDatabase } from '../utils/database'

// Attach the authenticated user (if any) to every /api request.
// Route handlers then just call requireUser() / requireManager().
// Self-registered accounts stay PENDING: their session can only reach
// /api/auth/* (me/logout) until a manager approves them.
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return
  event.context.user = await getSessionUser(event)
  if (!event.context.user || event.path.startsWith('/api/auth/')) return

  const database = useDatabase()
  const [current] = await database
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, event.context.user.id))
  if (current?.status === 'PENDING') {
    throw createError({ statusCode: 403, statusMessage: 'Account is awaiting manager approval' })
  }
})
