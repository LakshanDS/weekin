// Minimal fixed-window rate limiter for abuse-prone endpoints. In-memory per server
// instance — on Workers each isolate keeps its own counters; upgrade only if ever needed.

const buckets = new Map<string, { count: number; resetAt: number }>()
let lastSweep = 0

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()

  // opportunistic sweep so abandoned keys don't grow the map forever
  if (buckets.size > 10_000 || now - lastSweep > 60_000) {
    lastSweep = now
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k)
    }
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  bucket.count += 1
  if (bucket.count > max) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests — try again shortly.' })
  }
}

export function clientIp(event: Parameters<typeof getRequestIP>[0]): string {
  // cf-connecting-ip is set by Cloudflare from the real client; X-Forwarded-For's
  // leftmost entry is client-controlled and spoofable. Socket IP is right in dev/Node.
  return getRequestHeader(event, 'cf-connecting-ip') || getRequestIP(event) || 'unknown'
}
