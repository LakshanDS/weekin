import { eq } from 'drizzle-orm'
import { users } from '../database/schema'
import { useDatabase } from '../utils/database'
import { setSessionCookie } from '../utils/auth'

// Attach the session (if any) to every /api request; handlers call requireUser()/requireManager().
// The JWT is verified statelessly — the DB is hit only for stale tokens, PENDING claims,
// and MANAGER-claimed tokens, so a manager's demotion/deletion lands on the very next request.
// Stale tokens are re-issued with fresh claims (sliding sessions); PENDING sessions
// can only reach /api/auth/* until a manager approves them.
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return
  const session = await getSessionUser(event)
  event.context.user = session
  if (!session || event.path.startsWith('/api/auth/')) return

  if (session.stale || session.status === 'PENDING' || session.role === 'MANAGER') {
    const database = useDatabase(event)
    const [current] = await database
      .select({ status: users.status, role: users.role })
      .from(users)
      .where(eq(users.id, session.id))
    if (!current) {
      throw createError({ statusCode: 401, statusMessage: 'Account no longer exists' })
    }
    if (current.status === 'PENDING') {
      throw createError({ statusCode: 403, statusMessage: 'Account is awaiting manager approval' })
    }
    session.role = current.role
    session.status = current.status
    await setSessionCookie(event, { id: session.id, role: current.role, status: current.status })
  }
})
