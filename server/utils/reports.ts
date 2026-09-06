import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { H3Event } from 'h3'
import { reports, reportVersions, users, projects } from '../database/schema'
import type { ReportContent } from '#shared/types/report'

const managerUsers = alias(users, 'manager_user')

export interface ReportWithMeta {
  id: number
  userId: number
  projectId: number | null
  assignedManagerId: number | null
  assignedManagerName: string | null
  weekStart: string
  weekEnd: string
  status: 'DRAFT' | 'SUBMITTED' | 'NEEDS_CORRECTION' | 'APPROVED'
  submittedAt: Date | null
  reviewedAt: Date | null
  userName: string
  projectName: string | null
}

// Create/edit must point the report at a real, active manager.
export async function validateAssignedManager(database: ReturnType<typeof useDatabase>, managerId: number) {
  const [manager] = await database
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, managerId), eq(users.role, 'MANAGER'), eq(users.status, 'ACTIVE')))
  if (!manager) {
    throw createError({ statusCode: 422, statusMessage: 'Assigned manager must be an active manager' })
  }
}

// Load a report and enforce access: owners see their own, managers see all,
// anyone else gets a 404 (no existence leak).
export async function loadReportFor(event: H3Event, id: number) {
  const session = requireUser(event)
  const database = useDatabase(event)

  const [row] = await database
    .select({
      id: reports.id,
      userId: reports.userId,
      projectId: reports.projectId,
      assignedManagerId: reports.assignedManagerId,
      assignedManagerName: managerUsers.name,
      weekStart: reports.weekStart,
      weekEnd: reports.weekEnd,
      status: reports.status,
      submittedAt: reports.submittedAt,
      reviewedAt: reports.reviewedAt,
      userName: users.name,
      projectName: projects.name,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.userId))
    .leftJoin(projects, eq(projects.id, reports.projectId))
    .leftJoin(managerUsers, eq(managerUsers.id, reports.assignedManagerId))
    .where(eq(reports.id, id))

  if (!row || (session.role !== 'MANAGER' && row.userId !== session.id)) {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }
  // Drafts are private to their owner; other managers get the same 404 (no existence leak).
  if (row.status === 'DRAFT' && session.role === 'MANAGER' && row.userId !== session.id) {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }
  return { session, database, report: row, isOwner: row.userId === session.id }
}

export async function getLatestVersion(database: ReturnType<typeof useDatabase>, reportId: number) {
  const [version] = await database
    .select()
    .from(reportVersions)
    .where(eq(reportVersions.reportId, reportId))
    .orderBy(desc(reportVersions.versionNo))
    .limit(1)
  return version ?? null
}

// Managers review frozen content; the owner also sees their draft-in-progress edits.
export async function getVisibleVersion(database: ReturnType<typeof useDatabase>, reportId: number, isOwner: boolean) {
  if (isOwner) return getLatestVersion(database, reportId)
  const [version] = await database
    .select()
    .from(reportVersions)
    .where(and(eq(reportVersions.reportId, reportId), isNotNull(reportVersions.submittedAt)))
    .orderBy(desc(reportVersions.versionNo))
    .limit(1)
  return version ?? null
}

// Same visibility rule, but only the version id (enough for review actions).
export async function getVisibleVersionId(database: ReturnType<typeof useDatabase>, reportId: number) {
  const [version] = await database
    .select({ id: reportVersions.id })
    .from(reportVersions)
    .where(and(eq(reportVersions.reportId, reportId), isNotNull(reportVersions.submittedAt)))
    .orderBy(desc(reportVersions.versionNo))
    .limit(1)
  return version?.id ?? null
}

// Draft edits update the unsubmitted version in place; once frozen, edits
// open a new version. Returns the id of the version holding current content.
export async function saveContent(
  database: ReturnType<typeof useDatabase>,
  reportId: number,
  projectId: number | null,
  assignedManagerId: number,
  content: ReportContent,
) {
  // Status-guarded rewrite: a concurrent submit freezes the report, the update
  // matches nothing and the caller gets a 409 instead of silently repointing a
  // reviewed report at another project/manager.
  const touched = await database
    .update(reports)
    .set({ projectId, assignedManagerId, updatedAt: new Date() })
    .where(and(eq(reports.id, reportId), inArray(reports.status, ['DRAFT', 'NEEDS_CORRECTION'])))
    .returning({ id: reports.id })
  if (touched.length === 0) {
    throw createError({ statusCode: 409, statusMessage: 'Report is no longer editable' })
  }

  const latest = await getLatestVersion(database, reportId)

  if (latest && latest.submittedAt === null) {
    // Guarded update: if the version was frozen (submitted) between our read
    // and write, the WHERE matches nothing and we fall through to a new version.
    const updated = await database
      .update(reportVersions)
      .set({ ...content })
      .where(and(eq(reportVersions.id, latest.id), isNull(reportVersions.submittedAt)))
      .returning({ id: reportVersions.id })
    if (updated.length) return updated[0].id
  }

  // versionNo is computed outside a transaction: a concurrent submit can take
  // the same number and hit the unique index — re-read and insert once more.
  for (let attempt = 0; ; attempt++) {
    const current = attempt === 0 ? latest : await getLatestVersion(database, reportId)
    try {
      const [created] = await database
        .insert(reportVersions)
        .values({ reportId, versionNo: (current?.versionNo ?? 0) + 1, ...content })
        .returning({ id: reportVersions.id })
      return created.id
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error
      if (attempt > 0) {
        throw createError({ statusCode: 409, statusMessage: 'Report changed during save — try again' })
      }
    }
  }
}
