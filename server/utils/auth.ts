import { eq } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'
import { users } from '../database/schema'
import { useDatabase } from './database'
import bcrypt from 'bcryptjs'
import type { H3Event, EventHandlerRequest } from 'h3'

export const SESSION_COOKIE = 'session'
const SESSION_DAYS = 7

export interface SessionUser {
  id: number
  role: 'MEMBER' | 'MANAGER'
}

function getSecret(event: H3Event<EventHandlerRequest>) {
  const secret = useRuntimeConfig(event).jwtSecret
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_JWT_SECRET is not configured' })
  }
  return new TextEncoder().encode(secret)
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash)
}

export async function setSessionCookie(event: H3Event, user: SessionUser) {
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret(event))

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // 'development' check (not ==production): Cloudflare never sets NODE_ENV,
    // and the cookie must be Secure in every non-dev runtime.
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

// Verify the JWT from the cookie. Returns null for anonymous visitors.
export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(event))
    return { id: Number(payload.sub), role: payload.role as SessionUser['role'] }
  } catch {
    return null
  }
}

export function requireUser(event: H3Event): SessionUser {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  return user
}

export async function requireManager(event: H3Event): Promise<SessionUser> {
  const user = requireUser(event)
  if (user.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Manager access required' })
  }
  // The JWT is stateless: re-check the account still exists and is still a
  // manager, so removed or demoted accounts lose manager access immediately.
  const database = useDatabase()
  const [current] = await database
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
  if (!current || current.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Manager access required' })
  }
  return user
}
