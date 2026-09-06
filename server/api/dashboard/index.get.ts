import { getDashboardData } from '../../utils/dashboard'

// GET /api/dashboard?week=YYYY-MM-DD — summary + charts + activity (manager only)
export default defineEventHandler(async (event) => {
  await requireManager(event)
  const query = getQuery(event)
  const weekParam = typeof query.week === 'string' ? query.week : undefined
  const weekStart = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? mondayOf(weekParam) : mondayOf(new Date().toISOString().slice(0, 10))
  return getDashboardData(weekStart, event)
})
