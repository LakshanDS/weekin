import { and, count, desc, eq, gte, lte } from 'drizzle-orm'
import { reports, users, projects } from '../../database/schema'
import { reportListQuerySchema } from '#shared/schemas/report'

// GET /api/reports — paginated list with filters.
// Members always see only their own; managers see the whole team.
export default defineEventHandler(async (event) => {
  const session = requireUser(event)
  const query = await getValidatedQuery(event, reportListQuerySchema.parse)
  const database = useDatabase()

  const filters = [
    // Members are hard-scoped to their own rows regardless of query params.
    session.role === 'MANAGER' && query.userId ? eq(reports.userId, query.userId) : undefined,
    session.role !== 'MANAGER' ? eq(reports.userId, session.id) : undefined,
    query.status ? eq(reports.status, query.status) : undefined,
    query.projectId ? eq(reports.projectId, query.projectId) : undefined,
    query.from ? gte(reports.weekStart, query.from) : undefined,
    query.to ? lte(reports.weekStart, query.to) : undefined,
  ].filter((f) => f !== undefined)
  const where = filters.length ? and(...filters) : undefined

  const [rows, [total]] = await Promise.all([
    database
      .select({
        id: reports.id,
        userId: reports.userId,
        userName: users.name,
        projectId: reports.projectId,
        projectName: projects.name,
        weekStart: reports.weekStart,
        weekEnd: reports.weekEnd,
        status: reports.status,
        submittedAt: reports.submittedAt,
        reviewedAt: reports.reviewedAt,
      })
      .from(reports)
      .innerJoin(users, eq(users.id, reports.userId))
      .leftJoin(projects, eq(projects.id, reports.projectId))
      .where(where)
      .orderBy(desc(reports.weekStart), desc(reports.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    database.select({ value: count() }).from(reports).where(where),
  ])

  return { reports: rows, total: total.value, page: query.page, pageSize: query.pageSize }
})
