import { and, asc, countDistinct, eq, isNotNull } from 'drizzle-orm'
import { projectMembers, projects, reports } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const mine = getQuery(event).mine === '1'
  const database = useDatabase(event)

  // Two joined tables fan out the row count, so both counters must be distinct.
  const rows = await database
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      reportCount: countDistinct(reports.id),
      memberCount: countDistinct(projectMembers.id),
    })
    .from(projects)
    .leftJoin(
      projectMembers,
      mine
        ? and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, user.id))!
        : eq(projectMembers.projectId, projects.id),
    )
    .leftJoin(reports, eq(reports.projectId, projects.id))
    // With mine=1 the left join must behave like an inner join.
    .where(mine ? isNotNull(projectMembers.id) : undefined)
    .groupBy(projects.id)
    .orderBy(asc(projects.name))
  return { projects: rows }
})
