// Integration test for the self-registration approval flow.
// Requires the dev server running with a seeded database (bun run dev && bun run db:seed:demo):
//   bun run test
import { describe, expect, it } from 'vitest'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000/api'

interface Jar {
  cookie?: string
}

async function call(
  method: string,
  path: string,
  jar: Jar = {},
  body?: unknown,
): Promise<{ status: number; setCookie?: string; json: any }> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(jar.cookie ? { Cookie: jar.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = res.headers.get('content-type')?.includes('json') ? await res.json() : {}
  return {
    status: res.status,
    setCookie: res.headers.get('set-cookie') ?? undefined,
    json,
  }
}

async function loginAs(email: string, password: string): Promise<{ status: number; jar: Jar }> {
  const res = await call('POST', '/auth/login', {}, { email, password })
  return { status: res.status, jar: { cookie: res.setCookie?.split(';')[0] } }
}

describe('signup approval flow', () => {
  const stamp = Date.now()
  const PASS = 'password123'

  it('holds a self-registered account in PENDING until a manager approves it', async () => {
    const email = `pending-${stamp}@test.io`

    // Signup creates a PENDING member with a session
    const reg = await call('POST', '/auth/register', {}, { name: 'Pending Penny', email, password: PASS })
    expect(reg.status).toBe(201)
    expect(reg.json.user.status).toBe('PENDING')
    const penny: Jar = { cookie: reg.setCookie!.split(';')[0] }

    // Their session can reach /me (the waiting screen polls it)…
    const me = await call('GET', '/auth/me', penny)
    expect(me.status).toBe(200)
    expect(me.json.user.status).toBe('PENDING')

    // …but no workspace API until approved
    expect((await call('GET', '/reports', penny)).status).toBe(403)
    expect((await call('GET', '/dashboard', penny)).status).toBe(403)

    // The manager sees the signup in the user list
    const { jar: manager } = await loginAs('manager@demo.io', PASS)
    const list = await call('GET', '/users', manager)
    expect(list.status).toBe(200)
    const row = list.json.users.find((u: any) => u.email === email)
    expect(row?.status).toBe('PENDING')

    // Rejecting a bogus payload (approval only goes PENDING → ACTIVE), then approving
    expect((await call('PUT', `/users/${row.id}`, manager, { status: 'PENDING' })).status).toBe(422)
    const approved = await call('PUT', `/users/${row.id}`, manager, { status: 'ACTIVE' })
    expect(approved.status).toBe(200)
    expect(approved.json.user.status).toBe('ACTIVE')

    // Full access right away
    expect((await call('GET', '/reports', penny)).status).toBe(200)

    // Cleanup: delete the test account (also proves delete + cascades work)
    expect((await call('DELETE', `/users/${row.id}`, manager)).status).toBe(200)
  })

  it('deletes a discarded signup so the email can register again', async () => {
    const email = `cancel-${stamp}@test.io`

    const reg = await call('POST', '/auth/register', {}, { name: 'Cancel Carl', email, password: PASS })
    expect(reg.status).toBe(201)
    const carlId = reg.json.user.id

    const { jar: manager } = await loginAs('manager@demo.io', PASS)
    expect((await call('DELETE', `/users/${carlId}`, manager)).status).toBe(200)

    // Account gone: login rejected
    expect((await loginAs(email, PASS)).status).toBe(401)

    // The freed email can sign up again (then clean it up)
    const again = await call('POST', '/auth/register', {}, { name: 'Cancel Carl', email, password: PASS })
    expect(again.status).toBe(201)
    expect((await call('DELETE', `/users/${again.json.user.id}`, manager)).status).toBe(200)
  })
})
