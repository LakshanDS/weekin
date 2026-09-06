import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { z } from 'zod'
import { hashPassword } from '../../utils/auth'

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.email().max(255),
  password: z.string().min(8).max(100),
  role: z.enum(['MEMBER', 'MANAGER']),
})

// POST /api/users — admin creates an account directly ("invite") (manager only)
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const body = await validateBody(event, createUserSchema)
  const database = useDatabase()
  const email = body.email.toLowerCase()

  const [existing] = await database.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }

  const [user] = await database
    .insert(users)
    // Explicit: the column default may flip to PENDING; invites stay immediately active.
    .values({ name: body.name, email, passwordHash: await hashPassword(body.password), role: body.role, status: 'ACTIVE' })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })
  setResponseStatus(event, 201)
  return { user }
})
