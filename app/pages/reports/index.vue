<script setup lang="ts">
import { isoWeekOf, mondayOf } from '#shared/utils/week'
import type { ReportStatus } from '#shared/types/report'

const { user } = useAuth()
const isManager = computed(() => user.value?.role === 'MANAGER')
useHead({ title: 'Reports' })

interface ReportRow {
  id: number
  userId: number
  userName: string
  projectName: string | null
  weekStart: string
  weekEnd: string
  status: ReportStatus
  submittedAt: string | null
}

// Filters + page live in the URL query, so going back from a report restores
// the exact filtered view instead of the full list.
const route = useRoute()
const router = useRouter()
const fromParam = typeof route.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.from) ? route.query.from : ''

const page = ref(Math.max(1, Number(route.query.page) || 1))
const statusFilter = ref<'' | ReportStatus>((route.query.status as '' | ReportStatus) || '')
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
// Explicit member / project pickers (manager only); the API takes userId / projectId.
const memberFilter = ref<number | ''>(Number(route.query.userId) || '')
const projectFilter = ref<number | ''>(Number(route.query.projectId) || '')
const memberOptions = ref<{ id: number; name: string }[]>([])
const projectOptions = ref<{ id: number; name: string }[]>([])

// Dropdown lists: leading "All …" entry clears the filter.
const memberSelectOptions = computed(() => [
  { value: '' as const, label: 'All members' },
  ...memberOptions.value.map((m) => ({ value: m.id, label: m.name })),
])
const projectSelectOptions = computed(() => [
  { value: '' as const, label: 'All projects' },
  ...projectOptions.value.map((p) => ({ value: p.id, label: p.name })),
])
const _today = new Date()
const currentWeek = mondayOf(`${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-${String(_today.getDate()).padStart(2, '0')}`)
const week = ref(fromParam || currentWeek)
const weekActive = ref(!!fromParam)
const reports = ref<ReportRow[]>([])
const total = ref(0)
// Grand total across all reports; fetched once, unaffected by filters.
const totalAll = ref(0)
// Only the first load shows the loading state; later refreshes update in place
// so the page doesn't replay its entrance animations on every search.
const loading = ref(true)
const loaded = ref(false)

const STATUS_OPTIONS: { value: '' | ReportStatus; label: string }[] = [
  { value: '', label: 'All' },
  // Drafts are private to their owner — managers don't get the tab.
  ...(isManager.value ? [] : [{ value: 'DRAFT' as const, label: 'Draft' }]),
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'NEEDS_CORRECTION', label: 'Needs correction' },
  { value: 'APPROVED', label: 'Approved' },
]

// Label for the filtered-empty message; "weekly" when no status tab is active.
const filterLabel = computed(() => {
  if (!statusFilter.value) return 'weekly'
  return STATUS_OPTIONS.find((o) => o.value === statusFilter.value)?.label.toLowerCase() ?? 'weekly'
})

// Mirror the active filters/page into the URL (replace: no history spam).
function syncQuery() {
  const params: Record<string, string> = {}
  if (statusFilter.value) params.status = statusFilter.value
  if (memberFilter.value) params.userId = String(memberFilter.value)
  if (projectFilter.value) params.projectId = String(projectFilter.value)
  if (weekActive.value) {
    params.from = week.value
    params.to = week.value
  }
  const q = search.value.trim()
  if (q) params.q = q
  if (page.value > 1) params.page = String(page.value)
  router.replace({ query: params })
}

async function load() {
  if (!loaded.value) loading.value = true
  else syncQuery()
  try {
    const query = new URLSearchParams({ page: String(page.value), pageSize: '20' })
    if (statusFilter.value) query.set('status', statusFilter.value)
    if (memberFilter.value) query.set('userId', String(memberFilter.value))
    if (projectFilter.value) query.set('projectId', String(projectFilter.value))
    if (weekActive.value) {
      query.set('from', week.value)
      query.set('to', week.value)
    }
    const q = search.value.trim()
    if (q) query.set('q', q)
    const [res, all] = await Promise.all([
      $fetch<{ reports: ReportRow[]; total: number }>(`/api/reports?${query}`),
      loaded.value ? null : $fetch<{ total: number }>('/api/reports?page=1&pageSize=1'),
    ])
    reports.value = res.reports
    total.value = res.total
    if (all) totalAll.value = all.total
  } finally {
    loading.value = false
    loaded.value = true
  }
}

watch([statusFilter, week, weekActive, memberFilter, projectFilter], () => { page.value = 1; load() })

onMounted(() => {
  if (!isManager.value) return
  $fetch<{ users: { id: number; name: string; status: string }[] }>('/api/users').then((res) => {
    memberOptions.value = res.users
      .filter((u) => u.status === 'ACTIVE')
      .map((u) => ({ id: u.id, name: u.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })
  $fetch<{ projects: { id: number; name: string }[] }>('/api/projects').then((res) => {
    projectOptions.value = res.projects.map((p) => ({ id: p.id, name: p.name }))
  })
})

// Typed search: debounce so we don't hit the API per keystroke.
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  page.value = 1
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})
onUnmounted(() => clearTimeout(searchTimer))
onMounted(load)

const hasActiveFilters = computed(
  () => statusFilter.value !== '' || search.value.trim() !== '' || weekActive.value ||
    memberFilter.value !== '' || projectFilter.value !== '',
)

// Status strip is a single draggable row: grab anywhere and pull sideways.
const tabsStrip = ref<HTMLElement | null>(null)
let dragStart: { x: number; scrollLeft: number } | null = null
let dragMoved = false
const stripDragging = ref(false)

function onStripMove(e: PointerEvent) {
  if (!dragStart || !tabsStrip.value) return
  const dx = e.clientX - dragStart.x
  if (!dragMoved && Math.abs(dx) > 4) {
    dragMoved = true
    stripDragging.value = true
  }
  if (dragMoved) tabsStrip.value.scrollLeft = dragStart.scrollLeft - dx
}

function onStripUp() {
  window.removeEventListener('pointermove', onStripMove)
  window.removeEventListener('pointerup', onStripUp)
  stripDragging.value = false
  dragStart = null
  // The click after a drag must not activate the tab under the pointer.
  if (dragMoved) setTimeout(() => { dragMoved = false }, 0)
}

function onStripDown(e: PointerEvent) {
  if (e.button !== 0 || !tabsStrip.value) return
  dragStart = { x: e.clientX, scrollLeft: tabsStrip.value.scrollLeft }
  window.addEventListener('pointermove', onStripMove)
  window.addEventListener('pointerup', onStripUp)
}

// Swallow the click that follows a drag (capture phase, before the tab).
function onStripClick(e: MouseEvent) {
  if (!dragMoved) return
  e.preventDefault()
  e.stopPropagation()
  dragMoved = false
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onStripMove)
  window.removeEventListener('pointerup', onStripUp)
})

function resetFilters() {
  search.value = ''
  statusFilter.value = ''
  memberFilter.value = ''
  projectFilter.value = ''
  week.value = currentWeek
  weekActive.value = false
}

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)))
const latest = computed(() => reports.value[0] ?? null)

// Desktop column layouts: managers scan by member, members by week.
// Trailing tracks are fixed-width so columns align across rows.
const GRID_MANAGER = 'sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.15fr)_minmax(0,1fr)_160px_175px_75px]'
const GRID_MEMBER = 'sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_160px_175px_75px]'
</script>

<template>
  <div>
    <!-- Briefing band -->
    <section class="pt-4">
      <div class="flex flex-wrap items-start justify-between gap-6 max-sm:flex-nowrap max-sm:gap-x-4">
        <div class="min-w-0 flex-1">
          <h1
            class="rise text-[18px] sm:text-[clamp(24px,2.6vw,30px)] leading-[1.08] font-bold tracking-[-0.025em]"
            style="animation-delay: 0.12s"
          >
            {{ isManager ? 'All reports' : 'My reports' }}<span class="text-coral">.</span>
          </h1>
          <p
            v-if="!loading"
            class="rise mt-1.5 max-w-[560px] text-[13px] leading-[1.5] text-ink-soft sm:text-[14px]"
            style="animation-delay: 0.22s"
          >
            <template v-if="isManager">
              <b class="font-semibold text-ink">{{ totalAll }} report{{ totalAll === 1 ? '' : 's' }}</b>
              across the team.
            </template>
            <template v-else>
              <b class="font-semibold text-ink">{{ totalAll }} report{{ totalAll === 1 ? '' : 's' }}</b>
              on file.
            </template>
          </p>
        </div>

        <div v-if="!loading" class="rise flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.1s">
          <p class="font-mono text-[13px] font-semibold tracking-[0.15em] uppercase text-ink">
            {{ totalAll }} report{{ totalAll === 1 ? '' : 's' }}
          </p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            {{ pageCount }} page{{ pageCount === 1 ? '' : 's' }} · 20 per page
          </p>
          <p v-if="latest" class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            latest week {{ formatWeekRange(latest.weekStart, latest.weekEnd) }}
          </p>
        </div>
      </div>
    </section>

    <p v-if="loading" class="rise mt-8 font-mono text-sm text-ink-muted">Loading reports…</p>

    <template v-else>
      <!-- Filters: search · week · status tabs · new report.
           Mobile: 2-col grid — selects pair up, week shares a row with the status tabs. -->
      <div class="rise mt-5 flex flex-wrap items-center gap-x-3 gap-y-3 max-sm:grid max-sm:grid-cols-2" style="animation-delay: 0.3s">
        <input
          v-model="search"
          type="search"
          placeholder="Search member, project, date…"
          aria-label="Search reports"
          class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2 text-[13.5px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint sm:w-56 max-sm:col-span-2"
        >

        <div v-if="isManager" class="w-40 max-sm:w-auto">
          <AppSelect v-model="memberFilter" :options="memberSelectOptions" aria-label="Filter by team member" />
        </div>

        <div v-if="isManager" class="w-40 max-sm:w-auto">
          <AppSelect v-model="projectFilter" :options="projectSelectOptions" aria-label="Filter by project" />
        </div>

        <div class="w-40 max-sm:w-auto">
          <WeekPicker v-model="week" full class="w-full" @update:model-value="weekActive = true" />
        </div>

        <nav
          class="flex min-w-0 flex-1 items-center gap-x-1"
          aria-label="Filter by status"
        >
          <div
            ref="tabsStrip"
            class="flex min-w-0 flex-1 flex-nowrap items-center gap-x-0.5 overflow-x-auto select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            :class="stripDragging ? 'cursor-grabbing' : 'cursor-grab'"
            @pointerdown="onStripDown"
            @click.capture="onStripClick"
          >
            <button
              v-for="opt in STATUS_OPTIONS"
              :key="opt.value"
              type="button"
              class="shrink-0 cursor-pointer rounded-[2px] px-2.5 py-1.5 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors"
              :class="statusFilter === opt.value
                ? 'bg-coral-tint text-ink shadow-[inset_0_-2px_0_var(--color-coral)]'
                : 'text-ink-soft hover:text-ink'"
              :aria-pressed="statusFilter === opt.value"
              @click="statusFilter = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>

          <button
            v-if="hasActiveFilters"
            type="button"
            title="Reset all filters"
            aria-label="Reset all filters"
            class="-ml-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:text-coral"
            @click="resetFilters"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3v5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </nav>

        <NuxtLink
          v-if="!isManager"
          to="/reports/new"
          class="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a] max-sm:col-span-2 max-sm:text-center"
        >
          New report
        </NuxtLink>
      </div>

      <!-- List, newest week first -->
      <section class="mt-6">
        <div v-if="reports.length" class="border-t border-ink-subtle">
          <NuxtLink
            v-for="report in reports"
            :key="report.id"
            :to="`/reports/${report.id}`"
            class="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 border-b border-ink-subtle px-3 py-3.5 transition-colors hover:bg-ink-tint sm:gap-x-4"
            :class="isManager ? GRID_MANAGER : GRID_MEMBER"
          >
            <span v-if="isManager" class="flex min-w-0 items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-tint font-mono text-[10.5px] text-ink-soft"
                aria-hidden="true"
              >
                {{ initials(report.userName) }}
              </span>
              <span class="min-w-0">
                <b class="block truncate text-sm font-semibold">{{ report.userName }}</b>
                <span class="block truncate font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted sm:hidden">{{ report.projectName ?? '—' }}</span>
              </span>
            </span>

            <span class="min-w-0">
              <b class="block truncate font-mono text-[12.5px] font-semibold tracking-[0.12em] uppercase text-ink">
                Week {{ isoWeekOf(report.weekStart) }}
              </b>
              <span class="block truncate text-[12.5px] text-ink-muted">{{ formatWeekRange(report.weekStart, report.weekEnd) }}</span>
            </span>

            <span class="hidden min-w-0 truncate text-[13px] text-ink-soft sm:block">{{ report.projectName ?? '—' }}</span>

            <span class="justify-self-end sm:justify-self-start" :class="isManager ? 'max-sm:hidden' : ''">
              <StatusTag :status="report.status" />
            </span>

            <span class="hidden font-mono text-xs whitespace-nowrap text-ink-muted sm:block">
              {{ report.submittedAt ? formatDateTime(report.submittedAt) : '—' }}
            </span>

            <span class="border-b border-coral pb-0.5 text-[12.5px] font-medium text-coral transition-colors group-hover:text-coral-dark">
              Open →
            </span>
          </NuxtLink>
        </div>

        <!-- Empty states -->
        <div
          v-else-if="total === 0 && !hasActiveFilters"
          class="flex flex-col items-center gap-3 border-t border-ink-subtle py-12 text-center"
        >
          <span
            class="flex size-12 items-center justify-center rounded-full bg-ink-tint font-mono text-lg text-ink-muted"
            aria-hidden="true"
          >
            +
          </span>
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">
            No reports yet
          </p>
          <p class="max-w-[400px] text-[14px] leading-[1.5] text-ink-soft">
            <template v-if="isManager">Reports land here the moment a team member files one.</template>
            <template v-else>Start your first week with the “New report” button above.</template>
          </p>
        </div>

        <p v-else class="border-t border-ink-subtle py-8 text-center text-sm text-ink-muted">
          No {{ filterLabel.toLowerCase() }} reports{{ statusFilter ? ' — try another status' : '' }}.
        </p>
      </section>

      <!-- Pagination -->
      <div v-if="pageCount > 1" class="mt-5 flex items-center justify-between">
        <button
          :disabled="page <= 1"
          class="cursor-pointer rounded-[10px] border border-ink-subtle px-3.5 py-1.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-soft transition-colors hover:bg-ink-tint disabled:cursor-not-allowed disabled:opacity-40"
          @click="page--; load()"
        >
          ← Prev
        </button>
        <span class="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted">
          page {{ page }} / {{ pageCount }} · {{ total }} reports
        </span>
        <button
          :disabled="page >= pageCount"
          class="cursor-pointer rounded-[10px] border border-ink-subtle px-3.5 py-1.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-soft transition-colors hover:bg-ink-tint disabled:cursor-not-allowed disabled:opacity-40"
          @click="page++; load()"
        >
          Next →
        </button>
      </div>
    </template>
  </div>
</template>
