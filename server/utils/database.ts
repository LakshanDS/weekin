import type { H3Event } from 'h3'
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
  // prepare:false is required on Workers (no prepared statements over TCP); the short
  // idle timeout keeps sockets from leaking across Workers request contexts.
  return drizzle(
    postgres(config.databaseUrl, {
      prepare: false,
      // Workers: one socket per request context; Node (dev/preview): a real pool.
      max: IS_WORKERS ? 1 : 10,
      idle_timeout: 1,
      connect_timeout: 10,
      // Recycle pooled sockets (Node only — Workers sockets die with the request).
      ...(IS_WORKERS ? {} : { max_lifetime: 300 }),
    }),
    { schema },
  )
}

// Node: one pooled client per process. Workers: sockets may not cross request
// boundaries — fresh client per call unless an event pins it to the request context.
export function useDatabase(event?: H3Event): Database {
  if (event) {
    if (!event.context.db) event.context.db = createClient()
    return event.context.db as Database
  }
  if (IS_WORKERS) return createClient()
  if (!db) db = createClient()
  return db
}
