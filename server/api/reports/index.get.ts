import { and, count, desc, eq, gte, ilike, lte, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { reports, users, projects, reportVersions } from '../../database/schema'
import { reportListQuerySchema } from '#shared/schemas/report'

// GET /api/reports — paginated list with filters.
// Members always see only their own; managers see the whole team.
const LIKE_WILDCARDS = /[%_]/g
const managerUsers = alias(users, 'manager_user')

// Free-text match over member, project, week date and submitted date fragments.
function buildTextFilter(q: string) {
  const like = `%${q.replace(LIKE_WILDCARDS, '')}%`
  return or(
    ilike(users.name, like),
    ilike(projects.name, like),
    sql`${reports.weekStart}::text ilike ${like}`,
    sql`${reports.submittedAt}::text ilike ${like}`,
  )
}

export default defineEventHandler(async (event) => {
  const session = requireUser(event)
  const query = validateQuery(event, reportListQuerySchema)
  const database = useDatabase(event)

  const filters = [
    // Members are hard-scoped to their own rows regardless of query params.
    session.role === 'MANAGER' && query.userId ? eq(reports.userId, query.userId) : undefined,
    session.role !== 'MANAGER' ? eq(reports.userId, session.id) : undefined,
    // Drafts are private to their owner; managers never see them (even filtered).
    session.role === 'MANAGER' ? ne(reports.status, 'DRAFT') : undefined,
    query.status ? eq(reports.status, query.status) : undefined,
    query.projectId ? eq(reports.projectId, query.projectId) : undefined,
    query.from ? gte(reports.weekStart, query.from) : undefined,
    query.to ? lte(reports.weekStart, query.to) : undefined,
    query.q ? buildTextFilter(query.q) : undefined,
  ].filter((f) => f !== undefined)
  const where = filters.length ? and(...filters) : undefined

  // Count skips the manager/project joins — they can't change it. users/
  // projects are joined only when the text filter references them.
  let countQuery = database.select({ value: count() }).from(reports).$dynamic()
  if (query.q) {
    countQuery = countQuery
      .innerJoin(users, eq(users.id, reports.userId))
      .leftJoin(projects, eq(projects.id, reports.projectId))
  }
  if (where) countQuery = countQuery.where(where)

  const [rows, [total]] = await Promise.all([
    database
      .select({
        id: reports.id,
        userId: reports.userId,
        userName: users.name,
        projectId: reports.projectId,
        projectName: projects.name,
        assignedManagerId: reports.assignedManagerId,
        assignedManagerName: managerUsers.name,
        weekStart: reports.weekStart,
        weekEnd: reports.weekEnd,
        status: reports.status,
        submittedAt: reports.submittedAt,
        reviewedAt: reports.reviewedAt,
        // Frozen submissions; > 1 means the report went through correction and was re-submitted.
        versionCount: sql<number>`(select count(*) from ${reportVersions} where ${reportVersions.reportId} = ${reports.id} and ${reportVersions.submittedAt} is not null)`.mapWith(Number),
      })
      .from(reports)
      .innerJoin(users, eq(users.id, reports.userId))
      .leftJoin(projects, eq(projects.id, reports.projectId))
      .leftJoin(managerUsers, eq(managerUsers.id, reports.assignedManagerId))
      .where(where)
      .orderBy(desc(reports.weekStart), desc(reports.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    countQuery,
  ])

  return { reports: rows, total: total.value, page: query.page, pageSize: query.pageSize }
})
