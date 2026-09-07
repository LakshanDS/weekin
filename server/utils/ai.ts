import { and, asc, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { projects, reports, reportVersions, users } from '../database/schema'
import { addDaysIso, mondayOf } from '#shared/utils/week'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Compact, grounded snapshot of the team's last few weeks of reports.
export async function buildTeamContext(windowWeeks = 6, database: ReturnType<typeof useDatabase> = useDatabase()) {
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

  // Latest submitted version per report in SQL — only the JSONB we read
  // crosses the wire, not every historical version.
  const versions = rows.length
    ? await database
        .selectDistinctOn([reportVersions.reportId], {
          reportId: reportVersions.reportId,
          tasks: reportVersions.tasks,
          blockers: reportVersions.blockers,
          achievements: reportVersions.achievements,
          hoursByType: reportVersions.hoursByType,
        })
        .from(reportVersions)
        .where(and(inArray(reportVersions.reportId, rows.map((r) => r.id)), isNotNull(reportVersions.submittedAt)))
        .orderBy(asc(reportVersions.reportId), desc(reportVersions.versionNo))
    : []
  const latest = new Map(versions.map((v) => [v.reportId, v]))

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

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute(args: Record<string, unknown>): Promise<string>
}

interface LlmToolCall {
  id: string
  function: { name: string; arguments: string }
}

interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: LlmToolCall[]
  tool_call_id?: string
}

// Chat with tools: executes model-requested tool calls and feeds results back
// until the model answers in plain text. The final round omits `tools` to force
// a text answer; tool errors go back to the model as results, not exceptions.
export async function runAgentLoop(system: string, history: ChatMessage[], tools: ToolDef[], maxIterations = 3): Promise<string> {
  const config = useRuntimeConfig()
  const baseUrl = (config.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = config.aiModel || 'gpt-4o-mini'

  const messages: LlmMessage[] = [{ role: 'system', content: system }, ...history]
  for (let round = 0; round < maxIterations + 2; round++) {
    const res = await $fetch<{ choices: { message: LlmMessage }[] }>(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.aiApiKey}` },
      // Provider capacity blips (Gemini 503/429) are transient — retry instead of failing the chat.
      retry: 2,
      retryDelay: 1_000,
      retryStatusCodes: [429, 500, 502, 503, 504],
      body: JSON.stringify({
        model,
        messages,
        ...(round < maxIterations && {
          tools: tools.map(({ name, description, parameters }) => ({
            type: 'function',
            function: { name, description, parameters },
          })),
        }),
        max_tokens: 1500, // Gemini-family models spend thinking tokens from this budget
        temperature: 0.3,
      }),
    })
    const message = res.choices[0]?.message
    const toolCalls = message?.tool_calls ?? []
    if (!message || !toolCalls.length) return message?.content?.trim() || 'No answer received.'

    messages.push({ role: 'assistant', content: message.content, tool_calls: toolCalls })
    for (const call of toolCalls) {
      messages.push({ role: 'tool', tool_call_id: call.id, content: await runTool(tools, call) })
    }
  }
  return 'No answer received.'
}

async function runTool(tools: ToolDef[], call: LlmToolCall): Promise<string> {
  const tool = tools.find((t) => t.name === call.function.name)
  if (!tool) return JSON.stringify({ error: `unknown tool: ${call.function.name}` })
  try {
    const args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {}
    return await tool.execute(args)
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : 'tool execution failed' })
  }
}
