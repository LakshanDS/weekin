<script setup lang="ts">
import { addDaysIso, isoWeekOf, mondayOf } from '#shared/utils/week'

definePageMeta({ role: 'MANAGER' })

const { user } = useAuth()

const week = ref(mondayOf(new Date().toISOString().slice(0, 10)))
const data = ref<Awaited<ReturnType<typeof load>> | null>(null)
const loading = ref(true)

interface DashboardData {
  summary: {
    weekStart: string
    totalSubmitted: number
    approved: number
    needsCorrection: number
    openBlockers: number
    firstInQueue: string | null
    correctionNames: string[]
    compliance: { onTime: number; late: number; pending: number; totalMembers: number }
  }
  charts: {
    weeks: string[]
    tasksDoneTrend: { week: string; done: number }[]
    statusByMember: { name: string; SUBMITTED: number; NEEDS_CORRECTION: number; APPROVED: number }[]
    hoursByProject: { name: string; hours: number }[]
    hoursByType: Record<string, number>
  }
  activity: { type: string; at: string; text: string; reportId: number }[]
}

interface QueueRow {
  id: number
  userName: string
  projectName: string | null
  weekStart: string
  weekEnd: string
  submittedAt: string | null
}

const queue = ref<QueueRow[]>([])

async function load() {
  loading.value = true
  const [dashboard, reviewQueue] = await Promise.all([
    $fetch<DashboardData>(`/api/dashboard?week=${week.value}`),
    $fetch<{ reports: QueueRow[] }>('/api/reports?status=SUBMITTED&pageSize=5'),
  ])
  data.value = dashboard
  queue.value = reviewQueue.reports
  projectPage.value = 1
  loading.value = false
}

watch(week, load)
onMounted(load)

// --- week selection ---
const _today = new Date()
const todayIso = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-${String(_today.getDate()).padStart(2, '0')}`
const currentWeek = mondayOf(todayIso)

const hour = new Date().getHours()
const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
const firstName = computed(() => user.value?.name.split(' ')[0] ?? '')

const rangeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const weekRange = computed(() => {
  const from = rangeFmt.format(new Date(`${week.value}T00:00:00Z`))
  const to = rangeFmt.format(new Date(`${addDaysIso(week.value, 6)}T00:00:00Z`))
  return `${from} — ${to} ${week.value.slice(0, 4)}`
})

const stats = computed(() => {
  const s = data.value?.summary
  if (!s) return []
  const pct = Math.round((s.compliance.onTime / Math.max(1, s.compliance.totalMembers)) * 100)
  // everything handed in this week: submitted, approved, or sent back
  const allIn = s.totalSubmitted + s.approved + s.needsCorrection
  return [
    {
      value: allIn,
      dim: `/${s.compliance.totalMembers}`,
      label: 'Reports in',
      sub: `${s.approved} approved`,
      tone: '',
    },
    {
      value: s.totalSubmitted,
      dim: '',
      label: 'Review in queue',
      sub: s.firstInQueue
        ? s.totalSubmitted > 1
          ? `${s.firstInQueue} and other ${s.totalSubmitted - 1}`
          : s.firstInQueue
        : 'awaiting review',
      tone: '',
    },
    {
      value: `${pct}%`,
      dim: '',
      label: 'Compliance',
      sub: `${s.compliance.pending} pending · ${s.compliance.late} late`,
      tone: '',
    },
    {
      value: s.needsCorrection,
      dim: '',
      label: 'Needs correction',
      sub: 'waiting to be fixed',
      tone: s.needsCorrection > 0 ? 'text-correction' : '',
    },
    {
      value: s.openBlockers,
      dim: '',
      label: 'Open blockers',
      sub: 'across unapproved reports',
      tone: s.openBlockers > 0 ? 'text-correction' : '',
    },
  ]
})

const shortName = (full: string) => full.split(' ')[0]

// Hero sentence segments after "reports are in for this week." — strong = highlighted
const attentionParts = computed(() => {
  const s = data.value?.summary
  if (!s) return []
  const parts: { text: string; strong: boolean }[] = []
  const names = (s.correctionNames ?? []).map(shortName)
  let correction = ''
  if (names.length === 1) correction = `${names[0]}’s report needs correction`
  else if (names.length > 1) correction = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}’s reports need correction`
  if (correction) parts.push({ text: correction, strong: true })
  if (s.openBlockers > 0) {
    if (correction) parts.push({ text: ' · ', strong: false })
    parts.push({ text: `${correction ? '' : ' '}${s.openBlockers}`, strong: true })
    parts.push({ text: ` blocker${s.openBlockers > 1 ? 's' : ''} still open.`, strong: false })
  } else if (correction) {
    parts.push({ text: '.', strong: false })
  }
  return parts
})

const activityDot: Record<string, string> = {
  approved: 'bg-approved',
  sent_back: 'bg-correction',
  submitted: 'bg-submitted',
}

const PROJECT_PAGE_SIZE = 10
const projectPage = ref(1)
const sortedProjects = computed(() => {
  const rows = [...(data.value?.charts.hoursByProject ?? [])]
  return rows.sort((a, b) => b.hours - a.hours)
})
const totalProjectPages = computed(() =>
  Math.max(1, Math.ceil(sortedProjects.value.length / PROJECT_PAGE_SIZE)),
)
const projectRows = computed(() =>
  sortedProjects.value.slice((projectPage.value - 1) * PROJECT_PAGE_SIZE, projectPage.value * PROJECT_PAGE_SIZE),
)
</script>

<template>
  <div>
    <!-- Briefing band -->
    <section class="border-b border-ink-subtle pt-5" :class="data ? '' : 'pb-6'">
      <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-4 max-sm:flex-nowrap">
        <div class="min-w-0 flex-1">
          <h1
            class="rise text-[26px] leading-[1.1] font-bold tracking-[-0.025em] sm:text-[clamp(38px,5vw,58px)] sm:leading-[1.08]"
            style="animation-delay: 0.12s"
          >
            {{ greeting }}, {{ firstName }}<span class="text-coral">.</span>
          </h1>
          <p v-if="data" class="rise mt-2 text-[13px] leading-[1.45] text-ink-soft sm:hidden" style="animation-delay: 0.22s">
            <b class="font-semibold text-ink">{{ data.summary.totalSubmitted + data.summary.approved + data.summary.needsCorrection }} of {{ data.summary.compliance.totalMembers }}</b>
            reports in<template v-if="data.summary.needsCorrection"> · <b class="font-semibold text-correction">{{ data.summary.needsCorrection }}</b> to fix</template><template v-if="data.summary.openBlockers"> · {{ data.summary.openBlockers }} blocker{{ data.summary.openBlockers > 1 ? 's' : '' }} open</template>
          </p>
          <p class="rise mt-3 hidden max-w-[560px] text-[18px] leading-[1.55] text-ink-soft sm:block" style="animation-delay: 0.22s">
            <template v-if="data">
              <b class="font-semibold text-ink">{{ data.summary.totalSubmitted + data.summary.approved + data.summary.needsCorrection }} of {{ data.summary.compliance.totalMembers }}</b>
              reports are in for this week.
              <br v-if="attentionParts.length">
              <template v-for="(part, i) in attentionParts" :key="i"><b v-if="part.strong" class="font-semibold text-ink">{{ part.text }}</b><template v-else>{{ part.text }}</template></template>
            </template>
          </p>
        </div>

        <!-- Week selector — raw, right-aligned -->
        <div class="rise flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.1s">
          <p class="font-mono text-[13px] font-semibold tracking-[0.15em] uppercase text-ink">
            Week {{ isoWeekOf(week) }}
          </p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">{{ weekRange }}</p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            {{ data?.summary.compliance.totalMembers ?? '—' }} reports due
          </p>
          <div class="mt-1.5 flex items-center justify-end gap-1">
            <button
              v-if="week !== currentWeek"
              type="button"
              title="Back to current week"
              aria-label="Back to current week"
              class="flex cursor-pointer items-center justify-center p-1 text-ink-muted transition-colors hover:text-coral"
              @click="week = currentWeek"
            >
              <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 3v5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <WeekPicker v-model="week" />
          </div>
        </div>
      </div>

      <div v-if="data" class="mt-10 grid grid-cols-2 border-t border-ink-subtle lg:grid-cols-5">
        <div
          v-for="(s, i) in stats"
          :key="s.label"
          class="border-ink-subtle py-5 pl-6 pr-6"
          :class="[i % 2 === 1 ? 'border-l' : '', i < 4 ? 'border-b lg:border-b-0' : '', i > 0 ? 'lg:border-l' : '']"
        >
          <p class="text-[40px] leading-none font-bold tracking-[-0.01em]" :class="s.tone">
            {{ s.value }}<span v-if="s.dim" class="text-2xl font-medium text-ink-muted">{{ s.dim }}</span>
          </p>
          <p class="mt-2.5 font-mono text-[11px] tracking-[0.15em] uppercase text-ink-muted">{{ s.label }}</p>
          <p class="mt-0.5 text-[12.5px]" :class="s.tone ? 'text-correction' : 'text-ink-soft'">{{ s.sub }}</p>
        </div>
      </div>
    </section>

    <p v-if="loading && !data" class="mt-8 font-mono text-sm text-ink-muted">Loading dashboard…</p>

    <!-- Mobile: the two wrappers dissolve (display:contents) so all sections interleave as
         queue → hours by type → throughput → hours by project → status mix → activity (order-*).
         lg keeps the original main column + side rail. -->
    <div v-if="data" class="mt-11 grid gap-14 max-lg:flex max-lg:flex-col max-lg:gap-y-11 lg:grid-cols-[1fr_340px]">
      <!-- Main column -->
      <div class="min-w-0 max-lg:contents">
        <section class="order-1 min-w-0">
          <div class="flex items-start justify-between gap-4">
            <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">
              Review in queue<template v-if="queue.length"> · <span class="text-coral">{{ queue.length }}</span></template>
            </p>
            <NuxtLink
              v-if="queue.length"
              to="/review"
              class="border-b border-coral pb-0.5 text-[12.5px] font-medium text-coral transition-colors hover:text-coral-dark"
            >
              View all →
            </NuxtLink>
          </div>
          <div v-if="queue.length" class="mt-4 border-t border-ink-subtle">
            <NuxtLink
              v-for="report in queue"
              :key="report.id"
              :to="`/reports/${report.id}`"
              class="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 border-b border-ink-subtle px-3 py-4 transition-colors hover:bg-ink-tint sm:grid-cols-[1.2fr_1fr_auto_auto_auto] sm:gap-x-4"
            >
              <span class="flex min-w-0 items-center gap-3">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-tint font-mono text-[10.5px] text-ink-soft" aria-hidden="true">
                  {{ initials(report.userName) }}
                </span>
                <span class="min-w-0">
                  <b class="block truncate text-sm font-semibold">{{ report.userName }}</b>
                  <span class="block truncate font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted sm:hidden">{{ report.projectName ?? '—' }}</span>
                </span>
              </span>
              <span class="hidden text-[13px] text-ink-soft sm:block">{{ report.projectName ?? '—' }}</span>
              <span class="sm:hidden"><StatusTag status="SUBMITTED" compact /></span>
              <span class="hidden sm:block"><StatusTag status="SUBMITTED" /></span>
              <span class="hidden font-mono text-xs text-ink-muted sm:block">
                {{ report.submittedAt ? formatDateTime(report.submittedAt) : '—' }}
              </span>
              <span class="border-b border-coral pb-0.5 text-[12.5px] font-medium text-coral transition-colors group-hover:text-coral-dark">
                Review →
              </span>
            </NuxtLink>
          </div>
          <div v-else class="mt-4 flex flex-col items-center gap-3 border-t border-b border-ink-subtle py-10 text-center">
            <span
              class="flex size-12 items-center justify-center rounded-full bg-ink-tint font-mono text-lg text-ink-muted"
              aria-hidden="true"
            >
              ✓
            </span>
            <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">
              Nothing to review
            </p>
            <p class="max-w-[400px] text-[14px] leading-[1.5] text-ink-soft">
              Submitted reports will land here the moment a team member sends one.
            </p>
          </div>
        </section>

        <section class="order-3 min-w-0 lg:mt-11">
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">Throughput</p>
          <h2 class="mt-1.5 text-xl font-semibold tracking-[-0.01em]">Tasks done, week by week</h2>
          <LineChart :trend="data.charts.tasksDoneTrend" class="mt-4" />
        </section>

        <section class="order-5 min-w-0 lg:mt-11">
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">Status mix</p>
          <h2 class="mt-1.5 text-xl font-semibold tracking-[-0.01em]">Where reports land</h2>
          <StackedBar :rows="data.charts.statusByMember" class="mt-4" />
        </section>
      </div>

      <!-- Side rail -->
      <aside class="min-w-0 max-lg:contents">
        <section class="order-2 min-w-0">
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">Hours by type</p>
          <Doughnut :hours="data.charts.hoursByType" class="mt-4" />
        </section>

        <section class="order-4 min-w-0 lg:mt-11">
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">Hours by project</p>
          <ProjectBar :rows="projectRows" class="mt-4" />
          <div
            v-if="totalProjectPages > 1"
            class="mt-3 flex items-center justify-end gap-4 font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted"
          >
            <button
              type="button"
              class="cursor-pointer transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-muted"
              :disabled="projectPage === 1"
              @click="projectPage--"
            >
              ← Prev
            </button>
            <span>{{ projectPage }} / {{ totalProjectPages }}</span>
            <button
              type="button"
              class="cursor-pointer transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-muted"
              :disabled="projectPage === totalProjectPages"
              @click="projectPage++"
            >
              Next →
            </button>
          </div>
        </section>

        <section class="order-6 min-w-0 lg:mt-11">
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">Activity</p>
          <ol class="mt-1 border-t border-ink-subtle">
            <li
              v-for="(item, i) in data.activity"
              :key="i"
              class="border-b border-ink-subtle text-[13.5px] text-ink-soft"
            >
              <NuxtLink
                :to="`/reports/${item.reportId}`"
                class="group flex gap-3 px-3 py-3 transition-colors hover:bg-ink-tint"
              >
                <span class="mt-[7px] size-2 shrink-0 rounded-full" :class="activityDot[item.type] ?? 'bg-draft'" aria-hidden="true" />
                <span class="min-w-0 flex-1 transition-colors group-hover:text-ink group-hover:underline">
                  {{ item.text }}
                </span>
                <span class="shrink-0 font-mono text-[11px] text-ink-muted">{{ formatDateTime(item.at) }}</span>
              </NuxtLink>
            </li>
            <li v-if="data.activity.length === 0" class="border-b border-ink-subtle py-3 text-[13.5px] text-ink-muted">
              Nothing yet this window.
            </li>
          </ol>
        </section>
      </aside>
    </div>
  </div>
</template>
