<script setup lang="ts">
import { reportContentSchema, type CreateReportInput } from '#shared/schemas/report'
import type { ReportContent as ReportContentType, TaskItem } from '#shared/types/report'
import { addDaysIso, currentWeekRange } from '#shared/utils/week'
import { z } from 'zod'

// Editor for create (/reports/new) and edit (/reports/:id/edit).
// Emits after saving; the parent decides where to navigate.
const props = defineProps<{
  initial?: {
    reportId: number
    projectId: number | null
    assignedManagerId: number | null
    weekStart: string
    weekEnd: string
    content: ReportContentType | null
  }
}>()

const emit = defineEmits<{ saved: [reportId: number] }>()

const projects = ref<{ id: number; name: string }[]>([])
const managers = ref<{ id: number; name: string }[]>([])
const week = props.initial ?? {
  reportId: 0,
  projectId: null,
  assignedManagerId: null,
  ...currentWeekRange(),
  content: null,
}

const projectId = ref<number | null>(week.projectId)
const assignedManagerId = ref<number | null>(week.assignedManagerId)
const weekStart = ref(week.weekStart)
// The API derives weekEnd from the Monday anyway; send a matching Fri.
const weekEnd = computed(() => addDaysIso(weekStart.value, 4))

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
  if (!assignedManagerId.value) {
    issues.value = ['assignedManagerId: Select the manager who should review this report']
    return
  }
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
        body: {
          projectId: projectId.value,
          assignedManagerId: assignedManagerId.value,
          weekStart: weekStart.value,
          weekEnd: weekEnd.value,
          content: parsed.data,
        },
      })
      reportId = created.report.id
    } else {
      await $fetch(`/api/reports/${reportId}`, {
        method: 'PUT',
        body: { projectId: projectId.value, assignedManagerId: assignedManagerId.value, content: parsed.data },
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
  const [projectRes, managerRes] = await Promise.all([
    $fetch<{ projects: { id: number; name: string }[] }>('/api/projects'),
    $fetch<{ managers: { id: number; name: string }[] }>('/api/users/managers'),
  ])
  projects.value = projectRes.projects
  managers.value = managerRes.managers
})

// 38px matches the WeekPicker button so every single-line control sits on one height.
const INPUT = 'block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint'
const FIELD = 'block h-[38px] w-full rounded-md border border-ink-subtle bg-white px-3.5 py-0 text-[15px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint'
const SELECT = 'block h-[38px] w-full cursor-pointer rounded-md border border-ink-subtle bg-white px-3 pr-9 py-0 text-[15px] outline-none transition-colors hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint select-chevron'
const LABEL = 'mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted'
const EYEBROW = 'font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted'
const ADD_BTN = 'inline-flex h-7 cursor-pointer items-center rounded-[6px] border border-correction/40 px-2.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-coral-dark transition-colors hover:border-correction hover:bg-coral/10'
const ADD_BTN_GREEN = 'inline-flex h-7 cursor-pointer items-center rounded-[6px] border border-approved/40 px-2.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-approved transition-colors hover:border-approved hover:bg-approved/10'
const REMOVE_BTN_RED = 'inline-flex size-[38px] cursor-pointer items-center justify-center rounded-[6px] border border-correction/40 text-correction transition-colors hover:border-correction hover:bg-coral/10'
const REMOVE_BTN_GREEN = 'inline-flex size-[38px] cursor-pointer items-center justify-center rounded-[6px] border border-approved/40 text-approved transition-colors hover:border-approved hover:bg-approved/10'
const MINI_INPUT = 'h-[38px] rounded-md border border-ink-subtle bg-white px-2.5 py-0 text-sm tabular-nums outline-none transition-colors hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint'
const MINI_SELECT = 'h-[38px] cursor-pointer rounded-md border border-ink-subtle bg-white px-2 pr-7 py-0 text-sm outline-none transition-colors hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint select-chevron'
</script>

<template>
  <div class="space-y-8">
    <div v-if="issues.length" role="alert" class="rounded-[6px] border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
      <span class="font-medium">Fix before saving:</span>
      <ul class="mt-1 list-disc pl-5">
        <li v-for="(issue, i) in issues" :key="i">{{ issue }}</li>
      </ul>
    </div>

    <!-- Week, reviewing manager & project on one row -->
    <section class="grid gap-5" :class="week.reportId ? 'md:grid-cols-2' : 'md:grid-cols-3'">
      <div v-if="!week.reportId">
        <span :class="LABEL">Week</span>
        <WeekPicker v-model="weekStart" :end-offset="4" full />
      </div>
      <div>
        <label for="report-manager" :class="LABEL">Assigned manager</label>
        <select id="report-manager" v-model="assignedManagerId" required :class="SELECT">
          <option :value="null" disabled>Select a manager…</option>
          <option v-for="m in managers" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </div>
      <div>
        <label for="report-project" :class="LABEL">Project</label>
        <select id="report-project" v-model="projectId" :class="SELECT">
          <option :value="null">No project</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
    </section>

    <!-- Tasks -->
    <section>
      <div class="mb-3 flex items-center justify-between">
        <h3 :class="EYEBROW">Tasks completed</h3>
        <button type="button" :class="ADD_BTN" @click="tasks.push(emptyTask())">+ Add task</button>
      </div>
      <div class="space-y-3">
        <div v-for="(task, i) in tasks" :key="i" class="rounded-[6px] border border-ink-subtle bg-white p-3.5 transition-colors hover:border-[#d0d0d0]">
          <div class="flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input v-model="task.name" placeholder="Task name" :class="`min-w-full flex-1 sm:min-w-48 ${FIELD} max-sm:col-span-3`" />
            <select v-model="task.priority" :class="`w-[136px] max-sm:w-full ${MINI_SELECT}`" aria-label="Priority">
              <option>LOW</option><option>MEDIUM</option><option>HIGH</option>
            </select>
            <select v-model="task.status" :class="`w-[136px] max-sm:w-full ${MINI_SELECT}`" aria-label="Status">
              <option>TODO</option><option>IN_PROGRESS</option><option>DONE</option><option>BLOCKED</option>
            </select>
            <button v-if="tasks.length > 1" type="button"
              class="inline-flex h-[38px] cursor-pointer items-center rounded-[6px] border border-transparent px-2.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-correction transition-colors hover:border-correction/30 hover:bg-coral/10"
              @click="tasks.splice(i, 1)">
              Remove
            </button>
          </div>
          <div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm max-sm:grid max-sm:grid-cols-2">
            <label class="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-muted">
              <input v-model="task.plannedPct" type="number" min="0" max="100" :class="`w-16 ${MINI_INPUT}`" />
              <span class="shrink-0">Planned %</span>
            </label>
            <label class="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-muted">
              <input v-model="task.actualPct" type="number" min="0" max="100" :class="`w-16 ${MINI_INPUT}`" />
              <span class="shrink-0">Actual %</span>
            </label>
            <label class="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-muted">
              <input v-model="task.timePlannedH" type="number" min="0" :class="`w-16 ${MINI_INPUT}`" />
              <span class="shrink-0">Plan h</span>
            </label>
            <label class="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-muted">
              <input v-model="task.timeSpentH" type="number" min="0" :class="`w-16 ${MINI_INPUT}`" />
              <span class="shrink-0">Spent h</span>
            </label>
            <input v-model="task.deliverable" placeholder="Deliverable (PR, doc, release…)" :class="`min-w-40 flex-1 ${MINI_INPUT} max-sm:col-span-2`" />
          </div>
        </div>
      </div>
    </section>

    <!-- Hours -->
    <section>
      <h3 :class="`${EYEBROW} mb-3 block`">Hours by type (optional)</h3>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <label v-for="type in HOUR_TYPES" :key="type" class="flex items-center justify-between gap-2 rounded-[6px] border border-ink-subtle bg-white px-3 py-2 text-sm transition-colors hover:border-[#d0d0d0]">
          <span class="min-w-0 truncate font-mono text-[10px] tracking-[0.12em] uppercase text-ink-muted">{{ type }}</span>
          <input v-model="hours[type]" type="number" min="0" :class="`w-14 shrink-0 ${MINI_INPUT}`" />
        </label>
      </div>
    </section>

    <!-- Blockers & achievements -->
    <div class="grid gap-8 md:grid-cols-2">
      <section v-for="list in [{ key: 'achievements', title: 'Achievements', add: '+ Add achievement', items: achievements, accent: 'approved' },
                               { key: 'blockers', title: 'Blockers', add: '+ Add blocker', items: blockers, accent: 'correction' }]"
        :key="list.key">
        <div class="mb-3 flex items-center justify-between">
          <h3 :class="EYEBROW">{{ list.title }}</h3>
          <button type="button" :class="list.accent === 'approved' ? ADD_BTN_GREEN : ADD_BTN"
            @click="list.items.push({ text: '', isKey: list.items.length === 0 })">
            {{ list.add }}
          </button>
        </div>
        <div class="space-y-2">
          <div v-for="(item, i) in list.items" :key="i" class="flex items-center gap-2">
            <label class="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase"
              :class="item.isKey ? (list.accent === 'correction' ? 'text-coral-dark' : 'text-approved') : 'text-ink-muted'">
              <input v-model="item.isKey" type="radio" :name="`key-${list.key}`" :value="true" @change="list.items.forEach((o) => (o.isKey = o === item))" />
              Key
            </label>
            <input v-model="item.text" :placeholder="`${list.title.replace(/s$/, '')} description`"
              :class="`flex-1 ${MINI_INPUT}`" />
            <button type="button" aria-label="Remove"
              :class="list.accent === 'approved' ? REMOVE_BTN_GREEN : REMOVE_BTN_RED"
              @click="list.items.splice(i, 1)">
              <svg class="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <p v-if="list.items.length === 0" class="text-sm text-ink-muted">None — add one if needed.</p>
        </div>
      </section>
    </div>

    <!-- Next week -->
    <section>
      <h3 :class="`${EYEBROW} mb-3 block`">Planned for next week</h3>
      <textarea v-model="nextWeekLines" rows="4" placeholder="One item per line" :class="INPUT" />
    </section>

    <!-- Notes -->
    <section>
      <h3 :class="`${EYEBROW} mb-3 block`">Notes & links (optional)</h3>
      <textarea v-model="notes" rows="2" placeholder="Context, links to PRs or documents…" :class="INPUT" />
    </section>

    <!-- Actions: one row on mobile — Save draft takes ⅓, submit the rest -->
    <div class="flex flex-wrap items-center gap-3 border-t border-ink-subtle pt-6 max-sm:grid max-sm:grid-cols-3 max-sm:gap-2">
      <button :disabled="saving" type="button"
        class="cursor-pointer rounded-[10px] border border-ink-subtle px-5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-ink-tint disabled:opacity-60 max-sm:col-span-1 max-sm:whitespace-nowrap max-sm:px-2 max-sm:text-center max-sm:text-[12.5px]"
        @click="save(false)">
        {{ saving ? 'Saving…' : 'Save draft' }}
      </button>
      <button :disabled="saving" type="button"
        class="cursor-pointer rounded-[10px] bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a] disabled:opacity-60 max-sm:col-span-2 max-sm:whitespace-nowrap max-sm:px-3 max-sm:text-center"
        @click="save(true)">
        {{ saving ? 'Submitting…' : week.reportId ? 'Save & resubmit' : 'Save & submit for review' }}
      </button>
      <p v-if="!issues.length" class="font-mono text-[10.5px] tracking-[0.06em] text-ink-muted max-sm:col-span-3">
        Submitting freezes this content as a version your manager reviews.
      </p>
    </div>
  </div>
</template>
