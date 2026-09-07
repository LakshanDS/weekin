<script setup lang="ts">
import { isoWeekOf } from '#shared/utils/week'

definePageMeta({ role: 'MANAGER' })
useHead({ title: 'Review' })

const { user } = useAuth()

interface QueueRow {
  id: number
  userName: string
  projectName: string | null
  assignedManagerId: number | null
  assignedManagerName: string | null
  weekStart: string
  weekEnd: string
  // Frozen submissions; > 1 means the report went through correction and was re-submitted.
  versionCount: number
  submittedAt: string | null
}

const rows = ref<QueueRow[]>([])
const loading = ref(true)

const isMine = (row: QueueRow) => row.assignedManagerId != null && row.assignedManagerId === user.value?.id

// Filters live in the URL so going back from a report restores the filtered queue.
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
// '' = whole queue, then first-time vs re-submitted.
const statusFilter = ref<'' | 'SUBMITTED' | 'RESUBMITTED'>(
  (route.query.status as 'SUBMITTED' | 'RESUBMITTED') || '',
)

function syncQuery() {
  const params: Record<string, string> = {}
  if (search.value.trim()) params.q = search.value.trim()
  if (statusFilter.value) params.status = statusFilter.value
  router.replace({ query: params })
}
watch([search, statusFilter], syncQuery)

const STATUS_OPTIONS: { value: '' | 'SUBMITTED' | 'RESUBMITTED'; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'RESUBMITTED', label: 'Re-submitted' },
]

onMounted(async () => {
  try {
    const res = await $fetch<{ reports: QueueRow[] }>('/api/reports?status=SUBMITTED&pageSize=100')
    // Newest submissions on top.
    rows.value = [...res.reports].sort(
      (a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '') || b.id - a.id,
    )
  } finally {
    loading.value = false
  }
})

const oldest = computed(() => rows.value.at(-1) ?? null)

const waitingDays = (row: QueueRow) => {
  if (!row.submittedAt) return null
  return Math.max(0, Math.floor((Date.now() - new Date(row.submittedAt).getTime()) / 864e5))
}

const waitingShort = (row: QueueRow) => {
  const d = waitingDays(row)
  if (d === null) return '—'
  if (d === 0) return 'today'
  return `${d}d`
}

const waitingTone = (row: QueueRow) =>
  (waitingDays(row) ?? 0) >= 3 ? 'text-correction' : 'text-ink-muted'

const hasActiveFilters = computed(() => statusFilter.value !== '' || search.value.trim() !== '')

function resetFilters() {
  search.value = ''
  statusFilter.value = ''
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = rows.value.filter((r) => {
    if (statusFilter.value === 'SUBMITTED' && r.versionCount > 1) return false
    if (statusFilter.value === 'RESUBMITTED' && r.versionCount === 1) return false
    if (!q) return true
    return `${r.userName} ${r.projectName ?? ''}`.toLowerCase().includes(q)
  })
  // Reports assigned to the current manager come first, newest within each group.
  return list.sort(
    (a, b) =>
      Number(isMine(b)) - Number(isMine(a)) ||
      (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '') ||
      b.id - a.id,
  )
})

const memberCount = computed(() => new Set(rows.value.map((r) => r.userName)).size)
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
            Review queue<span class="text-coral">.</span>
          </h1>
          <p
            v-if="!loading"
            class="rise mt-1.5 max-w-[560px] text-[13px] leading-[1.5] text-ink-soft sm:text-[14px]"
            style="animation-delay: 0.22s"
          >
            <template v-if="rows.length">
              <b class="font-semibold text-ink">{{ rows.length }} report{{ rows.length > 1 ? 's' : '' }}</b>
              {{ rows.length > 1 ? 'are' : 'is' }} waiting on your decision.
            </template>
            <template v-else>
              The queue is clear — every submitted report has a decision.
            </template>
          </p>
        </div>

        <div class="rise flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.1s">
          <p class="font-mono text-[13px] font-semibold tracking-[0.15em] uppercase text-ink">
            {{ loading ? '—' : rows.length }} in queue
          </p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            {{ loading ? '—' : memberCount }} members waiting
          </p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            <template v-if="loading">oldest —</template>
            <template v-else-if="oldest">oldest {{ waitingShort(oldest) }}</template>
            <template v-else>oldest —</template>
          </p>
        </div>
      </div>
    </section>

    <p v-if="loading" class="rise mt-8 font-mono text-sm text-ink-muted">Loading queue…</p>

    <template v-else>
      <!-- Filters: search · status -->
      <div
        v-if="rows.length"
        class="rise mt-5 flex flex-wrap items-center gap-x-3 gap-y-3"
        style="animation-delay: 0.3s"
      >
        <input
          v-model="search"
          type="search"
          placeholder="Search member or project…"
          aria-label="Search review queue"
          class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2 text-[13.5px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint sm:w-56"
        >

        <nav
          class="flex min-w-0 flex-1 flex-nowrap items-center gap-x-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Filter by status"
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

      <!-- Queue, newest submission first -->
      <section v-if="rows.length" class="mt-6 border-t border-ink-subtle">
        <NuxtLink
          v-for="report in filtered"
          :key="report.id"
          :to="`/reports/${report.id}`"
          class="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 border-b border-ink-subtle px-3 py-3.5 transition-colors hover:bg-ink-tint lg:grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1fr)_110px_105px_75px] lg:gap-x-4"
        >
          <span class="flex min-w-0 items-center gap-3">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-tint font-mono text-[10.5px] text-ink-soft"
              aria-hidden="true"
            >
              {{ initials(report.userName) }}
            </span>
            <span class="min-w-0">
              <span class="flex items-center gap-1.5">
                <b class="truncate text-sm font-semibold">{{ report.userName }}</b>
                <span
                  v-if="isMine(report)"
                  class="shrink-0 rounded-[2px] bg-coral-tint px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.12em] uppercase text-coral-dark"
                >
                  assigned to you
                </span>
              </span>
              <span class="block truncate font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted lg:hidden">{{ report.projectName ?? '—' }}</span>
            </span>
            <span
              v-if="!isMine(report) && report.assignedManagerName"
              class="hidden shrink-0 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted xl:block"
            >
              for {{ report.assignedManagerName }}
            </span>
          </span>

          <span class="min-w-0">
            <b class="block truncate font-mono text-[12.5px] font-semibold tracking-[0.12em] uppercase text-ink">
              Week {{ isoWeekOf(report.weekStart) }}
            </b>
            <span class="block truncate text-[12.5px] text-ink-muted">{{ formatWeekRange(report.weekStart, report.weekEnd) }}</span>
          </span>

          <span class="hidden truncate text-[13px] text-ink-soft lg:block">{{ report.projectName ?? '—' }}</span>
          <span class="hidden whitespace-nowrap font-mono text-xs text-ink-muted lg:block">
            {{ report.submittedAt ? formatDateTime(report.submittedAt) : '—' }}
          </span>
          <span class="hidden whitespace-nowrap font-mono text-xs lg:block" :class="waitingTone(report)">
            waiting {{ waitingShort(report) }}
          </span>
          <span class="border-b border-coral pb-0.5 text-[12.5px] font-medium text-coral transition-colors group-hover:text-coral-dark">
            Review →
          </span>
        </NuxtLink>

        <!-- Filters matched nothing -->
        <div
          v-if="filtered.length === 0"
          class="flex flex-col items-center gap-3 border-b border-ink-subtle py-10 text-center"
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
            Try a different search or check another status tab.
          </p>
        </div>
      </section>

      <!-- Empty state -->
      <section
        v-else
        class="rise flex min-h-[55vh] flex-col items-center justify-center gap-3 border-t border-ink-subtle text-center"
        style="animation-delay: 0.2s"
      >
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
      </section>
    </template>
  </div>
</template>
