import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { projects, reports, reportVersions, users } from '../database/schema'
import { addDaysIso, mondayOf } from '#shared/utils/week'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Compact, grounded snapshot of the team's last few weeks of reports.
export async function buildTeamContext(windowWeeks = 6): Promise<string> {
  const database = useDatabase()
  const windowStart = addDaysIso(mondayOf(new Date().toISOString().slice(0, 10)), -7 * (windowWeeks - 1))

  const members = await database.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, 'MEMBER'))
  const rows = await database
    .select({
      id: reports.id,
      userId: reports.userId,
      userName: users.name,
      projectName: projects.name,
      weekStart: reports.weekStart,
      status: reports.status,
      submittedAt: reports.submittedAt,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.userId))
    .leftJoin(projects, eq(projects.id, reports.projectId))
    .where(and(gte(reports.weekStart, windowStart), inArray(reports.userId, members.map((m) => m.id))))
    .orderBy(desc(reports.weekStart))

  const versions = rows.length
    ? await database
        .select()
        .from(reportVersions)
        .where(and(inArray(reportVersions.reportId, rows.map((r) => r.id)), isNotNull(reportVersions.submittedAt)))
        .orderBy(desc(reportVersions.versionNo))
    : []
  const latest = new Map<number, (typeof versions)[number]>()
  for (const version of versions) {
    if (!latest.has(version.reportId)) latest.set(version.reportId, version)
  }

  const lines: string[] = [`Reporting window: weeks starting ${windowStart} to today. Weekly reports (submitted versions only):`]
  for (const report of rows) {
    const version = latest.get(report.id)
    if (!version) {
      lines.push(`- ${report.userName} | week ${report.weekStart} | ${report.status} | no submitted content`)
      continue
    }
    const done = version.tasks.filter((t) => t.status === 'DONE')
    const keyBlocker = version.blockers.find((b) => b.isKey) ?? version.blockers[0]
    const keyAchievement = version.achievements.find((a) => a.isKey) ?? version.achievements[0]
    const hours = Object.entries(version.hoursByType ?? {}).map(([k, v]) => `${k} ${v}h`).join(', ') || 'none'
    lines.push(
      [
        `- ${report.userName} | week ${report.weekStart} | ${report.status} | project: ${report.projectName ?? 'none'}`,
        `  tasks done: ${done.length}/${version.tasks.length} (${done.map((t) => t.name).join('; ') || '—'})`,
        `  key blocker: ${keyBlocker?.text ?? 'none'} | key achievement: ${keyAchievement?.text ?? 'none'}`,
        `  hours: ${hours}`,
      ].join('\n'),
    )
  }
  return lines.join('\n')
}

// One small wrapper over an OpenAI-compatible chat completions API.
// Config via env: NUXT_AI_API_KEY, NUXT_AI_BASE_URL, NUXT_AI_MODEL.
export function aiConfigured(): boolean {
  const config = useRuntimeConfig()
  return Boolean(config.aiApiKey)
}

export async function callLLM(system: string, history: ChatMessage[]): Promise<string> {
  const config = useRuntimeConfig()
  const baseUrl = (config.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = config.aiModel || 'gpt-4o-mini'

  const res = await $fetch<{ choices: { message: { content: string } }[] }>(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.aiApiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...history],
      max_tokens: 600,
      temperature: 0.3,
    }),
  })
  return res.choices[0]?.message?.content?.trim() ?? 'No answer received.'
}
