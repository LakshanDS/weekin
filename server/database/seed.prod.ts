// Seed: production login — creates the manager account only.
// Non-destructive and idempotent: never wipes data, skips if the email exists.
// Run: bun server/database/seed.prod.ts   (bun auto-loads .env)

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import { users } from './schema'

const database = drizzle(postgres(process.env.NUXT_DATABASE_URL!, { max: 1 }), {
  schema: { users },
})

const PROD_EMAIL = 'manager@weekin.com'
const PROD_PASSWORD = '3YosakHLZHaDixb4!Aa1'

async function main() {
  const passwordHash = await bcrypt.hash(PROD_PASSWORD, 10)
  const [manager] = await database
    .insert(users)
    .values({
      name: 'Lakshan De Silva',
      email: PROD_EMAIL,
      passwordHash,
      role: 'MANAGER' as const,
      // Explicit ACTIVE: the column default is PENDING (only self-signup should be pending).
      status: 'ACTIVE' as const,
    })
    .onConflictDoNothing({ target: users.email })
    .returning()

  if (manager) console.log(`Manager ready: ${PROD_EMAIL} / ${PROD_PASSWORD}`)
  else console.log(`${PROD_EMAIL} already exists — nothing changed.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
