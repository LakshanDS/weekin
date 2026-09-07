<script setup lang="ts">
import { addDaysIso, isoWeekOf, mondayOf } from '#shared/utils/week'
import type { ReportStatus } from '#shared/types/report'

definePageMeta({ role: 'MANAGER' })
useHead({ title: 'Team' })

interface MemberRow {
  userId: number
  name: string
  report: {
    id: number
    status: ReportStatus
    projectName: string | null
    submittedAt: string | null
    keyBlocker: string | null
    keyAchievement: string | null
  } | null
}

const _today = new Date()
const todayIso = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-${String(_today.getDate()).padStart(2, '0')}`
const currentWeek = mondayOf(todayIso)

// Filters live in the URL so going back from a report/profile restores them.
const route = useRoute()
const router = useRouter()
const weekParam = typeof route.query.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.week) ? route.query.week : ''

const week = ref(weekParam || currentWeek)
const rows = ref<MemberRow[]>([])
// Only the first load shows the loading state; later refreshes update in place.
const loading = ref(true)
const loaded = ref(false)

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const status = ref<'' | ReportStatus | 'NOT_STARTED'>(
  (route.query.status as ReportStatus | 'NOT_STARTED') || '',
)

function syncQuery() {
  const params: Record<string, string> = {}
  if (search.value.trim()) params.q = search.value.trim()
  if (week.value !== currentWeek) params.week = week.value
  if (status.value) params.status = status.value
  router.replace({ query: params })
}

const STATUS_OPTIONS: { value: '' | ReportStatus | 'NOT_STARTED'; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'NEEDS_CORRECTION', label: 'Needs correction' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'NOT_STARTED', label: 'Not started' },
]

async function load() {
  if (!loaded.value) loading.value = true
  try {
    const res = await $fetch<{ members: MemberRow[] }>(`/api/team/week?week=${week.value}`)
    rows.value = res.members
  } finally {
    loading.value = false
    loaded.value = true
  }
}
watch(week, () => { load(); syncQuery() })
watch([search, status], syncQuery)
onMounted(load)

const inCount = computed(() => rows.value.filter((r) => r.report).length)
const blockerCount = computed(() => rows.value.filter((r) => r.report?.keyBlocker).length)
const awaitingReview = computed(() => rows.value.filter((r) => r.report?.status === 'SUBMITTED').length)

// row order follows the workflow: actionable first, not-started last
const STATUS_ORDER: Record<string, number> = {
  SUBMITTED: 0,
  NEEDS_CORRECTION: 1,
  APPROVED: 2,
  NOT_STARTED: 3,
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = rows.value.filter((r) => {
    if (status.value === 'NOT_STARTED' && r.report) return false
    if (status.value && status.value !== 'NOT_STARTED' && r.report?.status !== status.value) return false
    if (!q) return true
    const hay = [r.name, r.report?.projectName, r.report?.keyBlocker, r.report?.keyAchievement]
      .filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
  return list.sort(
    (a, b) =>
      (STATUS_ORDER[a.report?.status ?? 'NOT_STARTED'] - STATUS_ORDER[b.report?.status ?? 'NOT_STARTED']) ||
      a.name.localeCompare(b.name),
  )
})

const hasActiveFilters = computed(
  () => status.value !== '' || search.value.trim() !== '' || week.value !== currentWeek,
)

function resetFilters() {
  search.value = ''
  status.value = ''
  week.value = currentWeek
}

const rangeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const weekRange = computed(() => {
  const from = rangeFmt.format(new Date(`${week.value}T00:00:00Z`))
  const to = rangeFmt.format(new Date(`${addDaysIso(week.value, 6)}T00:00:00Z`))
  return `${from} — ${to} ${week.value.slice(0, 4)}`
})
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
            Team week<span class="text-coral">.</span>
          </h1>
          <p
            v-if="!loading"
            class="rise mt-1.5 max-w-[560px] text-[13px] leading-[1.5] text-ink-soft sm:text-[14px]"
            style="animation-delay: 0.22s"
          >
            <template v-if="rows.length === 0">
              No members to show yet.
            </template>
            <template v-else-if="inCount === rows.length">
              All <b class="font-semibold text-ink">{{ rows.length }}</b> reports are in for this week<span
                v-if="blockerCount"
              >, and <b class="font-semibold text-ink">{{ blockerCount }}</b> flag{{ blockerCount > 1 ? '' : 's' }} a key blocker</span>.
            </template>
            <template v-else>
              <b class="font-semibold text-ink">{{ inCount }} of {{ rows.length }}</b> reports are in for this
              week<span v-if="blockerCount">, <b class="font-semibold text-ink">{{ blockerCount }}</b> with a key
              blocker</span>.
            </template>
          </p>
        </div>

        <div class="rise flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.1s">
          <p class="font-mono text-[13px] font-semibold tracking-[0.15em] uppercase text-ink">
            Week {{ isoWeekOf(week) }}
          </p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">{{ weekRange }}</p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            {{ loading ? '—' : awaitingReview }} awaiting review
          </p>
        </div>
      </div>
    </section>

    <p v-if="loading" class="rise mt-8 font-mono text-sm text-ink-muted">Loading team…</p>

    <template v-else>
      <!-- Filters: search · week · status · reset -->
      <div v-if="rows.length > 0" class="rise mt-5 flex flex-wrap items-center gap-x-3 gap-y-3" style="animation-delay: 0.3s">
        <input
          v-model="search"
          type="search"
          placeholder="Search member, project, blocker…"
          aria-label="Search team week"
          class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2 text-[13.5px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint sm:w-56"
        >

        <WeekPicker v-model="week" />

        <nav
          class="flex min-w-0 flex-1 flex-nowrap items-center gap-x-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Filter by status"
        >
          <button
            v-for="opt in STATUS_OPTIONS"
            :key="opt.value"
            type="button"
            class="shrink-0 cursor-pointer rounded-[2px] px-2.5 py-1.5 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors"
            :class="status === opt.value
              ? 'bg-coral-tint text-ink shadow-[inset_0_-2px_0_var(--color-coral)]'
              : 'text-ink-soft hover:text-ink'"
            :aria-pressed="status === opt.value"
            @click="status = opt.value"
          >
            {{ opt.label }}
          </button>

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
      </div>

      <!-- Side-by-side week rows -->
      <section class="mt-6">
        <div class="border-t border-ink-subtle">
          <NuxtLink
            v-for="row in filtered"
            :key="row.userId"
            :to="row.report ? `/reports/${row.report.id}` : `/members/${row.userId}`"
            class="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-ink-subtle px-3 py-3.5 transition-colors hover:bg-ink-tint sm:grid-cols-[1.1fr_0.9fr_1.2fr_1.2fr_170px_75px]"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-tint font-mono text-[10.5px] text-ink-soft"
                aria-hidden="true"
              >
                {{ initials(row.name) }}
              </span>
              <span class="min-w-0">
                <b class="block truncate text-sm font-semibold">{{ row.name }}</b>
                <span class="block truncate font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted md:hidden">{{ row.report ? row.report.projectName ?? '—' : 'Not started' }}</span>
              </span>
            </span>

            <span class="hidden truncate text-[13px] text-ink-soft md:block">{{ row.report?.projectName ?? '—' }}</span>

            <span
              class="hidden truncate text-[13px] md:block"
              :class="row.report?.keyBlocker ? 'text-correction' : 'text-ink-muted'"
              :title="row.report?.keyBlocker ?? undefined"
            >
              {{ row.report?.keyBlocker ?? '—' }}
            </span>

            <span
              class="hidden truncate text-[13px] md:block"
              :class="row.report?.keyAchievement ? 'text-approved' : 'text-ink-muted'"
              :title="row.report?.keyAchievement ?? undefined"
            >
              {{ row.report?.keyAchievement ?? '—' }}
            </span>

            <span class="hidden sm:block">
              <StatusTag v-if="row.report" :status="row.report.status" />
              <span
                v-else
                class="inline-flex items-center gap-1.5 rounded-full bg-ink-tint px-2.5 py-1 font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted"
              >
                <span class="size-1.5 rounded-full bg-current" />
                Not started
              </span>
            </span>

            <span class="border-b border-coral pb-0.5 text-[12.5px] font-medium text-coral transition-colors group-hover:text-coral-dark">
              {{ row.report ? 'Open →' : 'Profile →' }}
            </span>
          </NuxtLink>
        </div>

        <!-- Empty: no members at all -->
        <div
          v-if="rows.length === 0"
          class="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center"
        >
          <span
            class="flex size-12 items-center justify-center rounded-full bg-ink-tint font-mono text-lg text-ink-muted"
            aria-hidden="true"
          >
            ✓
          </span>
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">
            No members yet
          </p>
          <p class="max-w-[400px] text-[14px] leading-[1.5] text-ink-soft">
            Team members will appear here once they're added to the workspace.
          </p>
        </div>

        <!-- Empty: filters matched nothing -->
        <div
          v-else-if="filtered.length === 0"
          class="flex flex-col items-center gap-3 border-t border-b border-ink-subtle py-10 text-center"
        >
          <span
            class="flex size-12 items-center justify-center rounded-full bg-ink-tint font-mono text-lg text-ink-muted"
            aria-hidden="true"
          >
            ✓
          </span>
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">
            No one matches
          </p>
          <p class="max-w-[400px] text-[14px] leading-[1.5] text-ink-soft">
            Try a different search or clear the filters to see the whole team.
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
