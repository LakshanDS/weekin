import { and, desc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { reports, reportVersions, users, projects } from '../database/schema'
import type { ReportContent } from '#shared/types/report'

export interface ReportWithMeta {
  id: number
  userId: number
  projectId: number | null
  weekStart: string
  weekEnd: string
  status: 'DRAFT' | 'SUBMITTED' | 'NEEDS_CORRECTION' | 'APPROVED'
  submittedAt: Date | null
  reviewedAt: Date | null
  userName: string
  projectName: string | null
}

// Load a report and enforce access: owners see their own, managers see all,
// anyone else gets a 404 (no existence leak).
export async function loadReportFor(event: H3Event, id: number) {
  const session = requireUser(event)
  const database = useDatabase()

  const [row] = await database
    .select({
      id: reports.id,
      userId: reports.userId,
      projectId: reports.projectId,
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
    .where(eq(reports.id, id))

  if (!row || (session.role !== 'MANAGER' && row.userId !== session.id)) {
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
  const rows = await database
    .select()
    .from(reportVersions)
    .where(and(eq(reportVersions.reportId, reportId)))
    .orderBy(desc(reportVersions.versionNo))
  return rows.find((v) => v.submittedAt !== null) ?? null
}

// Draft edits update the unsubmitted version in place; once frozen, edits
// open a new version. Returns the id of the version holding current content.
export async function saveContent(
  database: ReturnType<typeof useDatabase>,
  reportId: number,
  projectId: number | null,
  content: ReportContent,
) {
  const latest = await getLatestVersion(database, reportId)
  if (latest && latest.submittedAt === null) {
    await database
      .update(reportVersions)
      .set({ ...content })
      .where(eq(reportVersions.id, latest.id))
    await database.update(reports).set({ projectId, updatedAt: new Date() }).where(eq(reports.id, reportId))
    return latest.id
  }
  const [created] = await database
    .insert(reportVersions)
    .values({ reportId, versionNo: (latest?.versionNo ?? 0) + 1, ...content })
    .returning({ id: reportVersions.id })
  await database.update(reports).set({ projectId, updatedAt: new Date() }).where(eq(reports.id, reportId))
  return created.id
}
