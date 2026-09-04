<script setup lang="ts">
import { reportContentSchema, type CreateReportInput } from '#shared/schemas/report'
import type { ReportContent as ReportContentType, TaskItem } from '#shared/types/report'
import { currentWeekRange } from '#shared/utils/week'
import { z } from 'zod'

// Editor for create (/reports/new) and edit (/reports/:id/edit).
// Emits after saving; the parent decides where to navigate.
const props = defineProps<{
  initial?: {
    reportId: number
    projectId: number | null
    weekStart: string
    weekEnd: string
    content: ReportContentType | null
  }
}>()

const emit = defineEmits<{ saved: [reportId: number] }>()

const projects = ref<{ id: number; name: string }[]>([])
const week = props.initial ?? { reportId: 0, projectId: null, ...currentWeekRange(), content: null }

const projectId = ref<number | null>(week.projectId)
const weekStart = ref(week.weekStart)
const weekEnd = ref(week.weekEnd)

const tasks = ref<TaskItem[]>(week.content?.tasks?.length ? [...week.content.tasks] : [emptyTask()])
const nextWeekLines = ref((week.content?.nextWeekTasks ?? []).join('\n'))
const blockers = ref(week.content?.blockers?.length ? [...week.content.blockers] : [])
const achievements = ref(week.content?.achievements?.length ? [...week.content.achievements] : [])
const hours = ref({ ...week.content?.hoursByType })
const notes = ref(week.content?.notes ?? '')

const saving = ref(false)
const issues = ref<string[]>([])

function emptyTask(): TaskItem {
  return { name: '', priority: 'MEDIUM', plannedPct: 50, actualPct: null, status: 'TODO', timePlannedH: null, timeSpentH: null, deliverable: '' }
}

const HOUR_TYPES = ['development', 'testing', 'meetings', 'documentation'] as const

function num(v: string | number | null | undefined): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function buildPayload(): CreateReportInput['content'] {
  return {
    tasks: tasks.value.map((t) => ({
      ...t,
      plannedPct: num(t.plannedPct) ?? 0,
      actualPct: num(t.actualPct),
      timePlannedH: num(t.timePlannedH),
      timeSpentH: num(t.timeSpentH),
    })),
    nextWeekTasks: nextWeekLines.value.split('\n').map((l) => l.trim()).filter(Boolean),
    blockers: blockers.value.map((b) => ({ text: b.text, isKey: b.isKey })),
    achievements: achievements.value.map((a) => ({ text: a.text, isKey: a.isKey })),
    hoursByType: Object.fromEntries(
      HOUR_TYPES.filter((type) => num(hours.value[type]) !== null).map((type) => [type, num(hours.value[type])]),
    ),
    notes: notes.value.trim() || null,
  }
}

async function save(submitAfter: boolean) {
  issues.value = []
  const parsed = reportContentSchema.safeParse(buildPayload())
  if (!parsed.success) {
    issues.value = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    return
  }

  saving.value = true
  try {
    let reportId = week.reportId
    if (!reportId) {
      const created = await $fetch<{ report: { id: number } }>('/api/reports', {
        method: 'POST',
        body: { projectId: projectId.value, weekStart: weekStart.value, weekEnd: weekEnd.value, content: parsed.data },
      })
      reportId = created.report.id
    } else {
      await $fetch(`/api/reports/${reportId}`, {
        method: 'PUT',
        body: { projectId: projectId.value, content: parsed.data },
      })
    }
    if (submitAfter) {
      await $fetch(`/api/reports/${reportId}/submit`, { method: 'POST' })
    }
    emit('saved', reportId)
  } catch (err) {
    const e = err as { data?: { statusMessage?: string }; statusCode?: number }
    issues.value = [e.data?.statusMessage ?? 'Could not save. Try again.']
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const res = await $fetch<{ projects: { id: number; name: string }[] }>('/api/projects')
  projects.value = res.projects
})
</script>

<template>
  <div class="space-y-8">
    <div v-if="issues.length" role="alert" class="border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
      <span class="font-medium">Fix before saving:</span>
      <ul class="mt-1 list-disc pl-5">
        <li v-for="(issue, i) in issues" :key="i">{{ issue }}</li>
      </ul>
    </div>

    <!-- Week & project -->
    <section class="grid gap-5 sm:grid-cols-3">
      <div v-if="!week.reportId">
        <label class="mb-1.5 block font-mono text-[11px] tracking-widest text-ink-500 uppercase">Week start</label>
        <input v-model="weekStart" type="date" class="block w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-approved" />
      </div>
      <div v-if="!week.reportId">
        <label class="mb-1.5 block font-mono text-[11px] tracking-widest text-ink-500 uppercase">Week end</label>
        <input v-model="weekEnd" type="date" class="block w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-approved" />
      </div>
      <div>
        <label class="mb-1.5 block font-mono text-[11px] tracking-widest text-ink-500 uppercase">Project</label>
        <select v-model="projectId" class="block w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-approved">
          <option :value="null">No project</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
    </section>

    <!-- Tasks -->
    <section>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Tasks completed</h3>
        <button type="button" class="cursor-pointer border border-line px-2.5 py-1 text-xs font-medium hover:border-ink-500" @click="tasks.push(emptyTask())">
          + Add task
        </button>
      </div>
      <div class="space-y-3">
        <div v-for="(task, i) in tasks" :key="i" class="border border-line bg-white p-3">
          <div class="flex flex-wrap items-center gap-2">
            <input v-model="task.name" placeholder="Task name" class="min-w-48 flex-1 border border-line px-2.5 py-1.5 text-sm outline-none focus:border-approved" />
            <select v-model="task.priority" class="border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-approved">
              <option>LOW</option><option>MEDIUM</option><option>HIGH</option>
            </select>
            <select v-model="task.status" class="border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-approved">
              <option>TODO</option><option>IN_PROGRESS</option><option>DONE</option><option>BLOCKED</option>
            </select>
            <button v-if="tasks.length > 1" type="button" class="cursor-pointer px-2 py-1 text-sm text-correction hover:underline" @click="tasks.splice(i, 1)">
              Remove
            </button>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <label class="flex items-center gap-1.5 font-mono text-[11px] text-ink-500 uppercase">Planned %
              <input v-model="task.plannedPct" type="number" min="0" max="100" class="w-16 border border-line px-2 py-1 tabular-nums outline-none focus:border-approved" />
            </label>
            <label class="flex items-center gap-1.5 font-mono text-[11px] text-ink-500 uppercase">Actual %
              <input v-model="task.actualPct" type="number" min="0" max="100" class="w-16 border border-line px-2 py-1 tabular-nums outline-none focus:border-approved" />
            </label>
            <label class="flex items-center gap-1.5 font-mono text-[11px] text-ink-500 uppercase">Plan h
              <input v-model="task.timePlannedH" type="number" min="0" class="w-14 border border-line px-2 py-1 tabular-nums outline-none focus:border-approved" />
            </label>
            <label class="flex items-center gap-1.5 font-mono text-[11px] text-ink-500 uppercase">Spent h
              <input v-model="task.timeSpentH" type="number" min="0" class="w-14 border border-line px-2 py-1 tabular-nums outline-none focus:border-approved" />
            </label>
            <input v-model="task.deliverable" placeholder="Deliverable (PR, doc, release…)" class="min-w-40 flex-1 border border-line px-2.5 py-1 text-sm outline-none focus:border-approved" />
          </div>
        </div>
      </div>
    </section>

    <div class="grid gap-8 md:grid-cols-2">
      <!-- Next week -->
      <section>
        <h3 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Planned for next week</h3>
        <textarea v-model="nextWeekLines" rows="4" placeholder="One item per line"
          class="block w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-approved" />
      </section>

      <!-- Hours -->
      <section>
        <h3 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Hours by type (optional)</h3>
        <div class="grid grid-cols-2 gap-3">
          <label v-for="type in HOUR_TYPES" :key="type" class="flex items-center justify-between gap-2 border border-line bg-white px-3 py-2 text-sm">
            <span class="font-mono text-[11px] text-ink-500 uppercase">{{ type }}</span>
            <input v-model="hours[type]" type="number" min="0" class="w-16 border border-line px-2 py-1 tabular-nums outline-none focus:border-approved" />
          </label>
        </div>
      </section>
    </div>

    <!-- Blockers & achievements -->
    <div class="grid gap-8 md:grid-cols-2">
      <section v-for="list in [{ key: 'blockers', title: 'Blockers', add: '+ Add blocker', items: blockers, accent: 'correction' },
                               { key: 'achievements', title: 'Achievements', add: '+ Add achievement', items: achievements, accent: 'approved' }]"
        :key="list.key">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">{{ list.title }}</h3>
          <button type="button" class="cursor-pointer border border-line px-2.5 py-1 text-xs font-medium hover:border-ink-500"
            @click="list.items.push({ text: '', isKey: list.items.length === 0 })">
            {{ list.add }}
          </button>
        </div>
        <div class="space-y-2">
          <div v-for="(item, i) in list.items" :key="i" class="flex items-center gap-2">
            <label class="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase"
              :class="item.isKey ? (list.accent === 'correction' ? 'text-correction' : 'text-approved') : 'text-draft'">
              <input v-model="item.isKey" type="radio" :name="`key-${list.key}`" :value="true" @change="list.items.forEach((o) => (o.isKey = o === item))" />
              Key
            </label>
            <input v-model="item.text" :placeholder="`${list.title.replace(/s$/, '')} description`"
              class="flex-1 border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-approved" />
            <button type="button" class="cursor-pointer px-1.5 text-sm text-correction hover:underline" @click="list.items.splice(i, 1)">×</button>
          </div>
          <p v-if="list.items.length === 0" class="text-sm text-ink-500">None — add one if needed.</p>
        </div>
      </section>
    </div>

    <!-- Notes -->
    <section>
      <h3 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Notes & links (optional)</h3>
      <textarea v-model="notes" rows="2" placeholder="Context, links to PRs or documents…"
        class="block w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-approved" />
    </section>

    <!-- Actions -->
    <div class="flex flex-wrap gap-3 border-t border-line pt-6">
      <button :disabled="saving" type="button"
        class="cursor-pointer border border-line bg-white px-5 py-2.5 text-sm font-medium hover:border-ink-500 disabled:opacity-60"
        @click="save(false)">
        {{ saving ? 'Saving…' : 'Save draft' }}
      </button>
      <button :disabled="saving" type="button"
        class="cursor-pointer bg-approved px-5 py-2.5 text-sm font-semibold text-white hover:bg-approved/90 disabled:opacity-60"
        @click="save(true)">
        {{ saving ? 'Submitting…' : week.reportId ? 'Save & resubmit' : 'Save & submit for review' }}
      </button>
      <p v-if="!issues.length" class="self-center font-mono text-[11px] text-draft">
        Submitting freezes this content as a version your manager reviews.
      </p>
    </div>
  </div>
</template>
