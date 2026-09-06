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
  const database = useDatabase(event)
  const email = body.email.toLowerCase()

  const [existing] = await database.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }

  // Invited accounts are active immediately; only self-registration starts PENDING.
  let user
  try {
    const [created] = await database
      .insert(users)
      .values({ name: body.name, email, passwordHash: await hashPassword(body.password), role: body.role, status: 'ACTIVE' })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })
    user = created
  } catch (error) {
    // 23505: a concurrent invite raced past the pre-check to the unique index.
    if ((error as { code?: string }).code !== '23505') throw error
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }
  setResponseStatus(event, 201)
  return { user }
})
