// Integration test for the review cycle and role-based access control.
// Requires the dev server running with a seeded database (bun run dev && bun run db:seed):
//   bun run test
import { describe, expect, it } from 'vitest'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000/api'
const PASS = 'password123'

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

async function login(email: string): Promise<Jar> {
  const { status, setCookie } = await call('POST', '/auth/login', {}, { email, password: PASS })
  expect(status, `login ${email}`).toBe(200)
  return { cookie: setCookie!.split(';')[0] }
}

const content = {
  tasks: [
    {
      name: 'Build report editor',
      priority: 'HIGH',
      plannedPct: 60,
      actualPct: 30,
      status: 'IN_PROGRESS',
      timePlannedH: 10,
      timeSpentH: 5,
      deliverable: 'Editor UI',
    },
  ],
  nextWeekTasks: ['Polish editor'],
  blockers: [{ text: 'Waiting on API', isKey: true }],
  achievements: [],
  hoursByType: { development: 12, meetings: 2 },
  notes: null,
}

describe('report review cycle & RBAC', () => {
  const week = { weekStart: '2026-09-07', weekEnd: '2026-09-11' }
  let alice: Jar
  let bob: Jar
  let manager: Jar
  let reportId: number

  it('logs in all three test accounts', async () => {
    alice = await login('alice@demo.io')
    bob = await login('bob@demo.io')
    manager = await login('manager@demo.io')
  })

  it('creates a draft and rejects a duplicate week', async () => {
    // keep reruns idempotent: drop leftovers first (managers may remove any report)
    const list = await call('GET', `/reports?from=${week.weekStart}&to=${week.weekStart}`, alice)
    for (const stale of list.json.reports) {
      const del = await call('DELETE', `/reports/${stale.id}`, alice)
      if (del.status !== 200) await call('DELETE', `/reports/${stale.id}`, manager)
    }

    const projects = await call('GET', '/projects', alice)
    const { status, json } = await call('POST', '/reports', alice, {
      projectId: projects.json.projects[0].id,
      ...week,
      content,
    })
    expect(status).toBe(201)
    expect(json.report.status).toBe('DRAFT')
    reportId = json.report.id

    const dup = await call('POST', '/reports', alice, {
      projectId: projects.json.projects[0].id,
      ...week,
      content,
    })
    expect(dup.status).toBe(409)
  })

  it('edits the draft in place (still one version), then submits', async () => {
    const put = await call('PUT', `/reports/${reportId}`, alice, { projectId: null, content })
    expect(put.status).toBe(200)

    const versions = await call('GET', `/reports/${reportId}/versions`, alice)
    expect(versions.json.versions).toHaveLength(1)
    expect(versions.json.versions[0].submittedAt).toBeNull()

    const submit = await call('POST', `/reports/${reportId}/submit`, alice)
    expect(submit.status).toBe(200)
    expect(submit.json.status).toBe('SUBMITTED')
  })

  it('hides other members reports and blocks member review actions', async () => {
    expect((await call('GET', `/reports/${reportId}`, bob)).status).toBe(404)
    expect((await call('POST', `/reports/${reportId}/approve`, alice, {})).status).toBe(403)
    expect((await call('PUT', `/reports/${reportId}`, manager, { projectId: null, content })).status).toBe(403)
    // members cannot list someone else's reports even with a userId filter
    const list = await call('GET', '/reports?userId=999', bob)
    expect(list.json.reports.every((r: any) => r.userId !== 999)).toBe(true)
  })

  it('manager requests changes: comment is tied to version 1', async () => {
    const res = await call('POST', `/reports/${reportId}/request-changes`, manager, {
      comment: 'Add actual percentages for the task.',
    })
    expect(res.status).toBe(200)
    expect(res.json.status).toBe('NEEDS_CORRECTION')

    const detail = await call('GET', `/reports/${reportId}`, alice)
    const comment = detail.json.comments.at(-1)
    expect(comment.action).toBe('REQUEST_CHANGES')
    expect(comment.versionNo).toBe(1)
  })

  it('editing after freeze opens version 2, resubmit makes it the review target', async () => {
    const edited = {
      ...content,
      tasks: [{ ...content.tasks[0], actualPct: 60, timeSpentH: 10 }],
    }
    await call('PUT', `/reports/${reportId}`, alice, { projectId: null, content: edited })
    const versions = await call('GET', `/reports/${reportId}/versions`, alice)
    expect(versions.json.versions).toHaveLength(2)
    expect(versions.json.versions[1].submittedAt).toBeNull()

    const submit = await call('POST', `/reports/${reportId}/submit`, alice)
    expect(submit.json.status).toBe('SUBMITTED')

    const detail = await call('GET', `/reports/${reportId}`, manager)
    expect(detail.json.content.versionNo).toBe(2)
  })

  it('manager approves; report locks; comment history spans both versions', async () => {
    const res = await call('POST', `/reports/${reportId}/approve`, manager, { comment: 'Fixed, thanks.' })
    expect(res.json.status).toBe('APPROVED')
    expect((await call('PUT', `/reports/${reportId}`, alice, { projectId: null, content })).status).toBe(409)

    const detail = await call('GET', `/reports/${reportId}`, alice)
    const actions = detail.json.comments.map((c: any) => [c.action, c.versionNo])
    expect(actions).toContainEqual(['REQUEST_CHANGES', 1])
    expect(actions).toContainEqual(['APPROVE', 2])

    // leave no trace: managers can remove even approved reports (moderation delete)
    expect((await call('DELETE', `/reports/${reportId}`, manager)).status).toBe(200)
  })

  it('exposes manager-only endpoints to managers only', async () => {
    expect((await call('GET', '/dashboard', alice)).status).toBe(403)
    expect((await call('GET', '/users', bob)).status).toBe(403)
    expect((await call('GET', '/dashboard', manager)).status).toBe(200)
  })
})
