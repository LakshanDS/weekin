import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

// Lazily create one pooled client per server instance.
// Lives in server/utils so Nitro auto-imports it into route handlers.
export function useDatabase() {
  if (!db) {
    const config = useRuntimeConfig()
    if (!config.databaseUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: 'NUXT_DATABASE_URL is not configured',
      })
    }
    db = drizzle(postgres(config.databaseUrl), { schema })
  }
  return db
}
