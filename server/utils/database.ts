import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema'

type Database = ReturnType<typeof drizzle>

// Detect the Cloudflare Workers runtime (navigator.userAgent is 'Node.js/x' under Node).
const IS_WORKERS = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'

let db: Database | null = null

function createClient() {
  const config = useRuntimeConfig()
  if (!config.databaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_DATABASE_URL is not configured',
    })
  }
  // prepare:false is required on Workers (no prepared statements over TCP).
  // A short idle timeout means sockets close quickly and never leak across
  // the Workers per-request I/O contexts.
  return drizzle(
    postgres(config.databaseUrl, { prepare: false, max: 1, idle_timeout: 1, connect_timeout: 10 }),
    { schema },
  )
}

// Node (dev/preview): one pooled client per server instance.
// Workers: sockets may not cross request boundaries, so return a fresh
// client per call — production-hardening option is a Hyperdrive binding.
export function useDatabase(): Database {
  if (IS_WORKERS) return createClient()
  if (!db) db = createClient()
  return db
}
