<script setup lang="ts">
import type { ReportStatus } from '#shared/types/report'

const { user } = useAuth()
const isManager = computed(() => user.value?.role === 'MANAGER')

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

const page = ref(1)
const statusFilter = ref('')
const reports = ref<ReportRow[]>([])
const total = ref(0)
const loading = ref(true)

const STATUS_OPTIONS: ReportStatus[] = ['DRAFT', 'SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED']

async function load() {
  loading.value = true
  const query = new URLSearchParams({ page: String(page.value), pageSize: '20' })
  if (statusFilter.value) query.set('status', statusFilter.value)
  const res = await $fetch<{ reports: ReportRow[]; total: number }>(`/api/reports?${query}`)
  reports.value = res.reports
  total.value = res.total
  loading.value = false
}

watch([statusFilter], () => { page.value = 1; load() })
onMounted(load)

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)))
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl font-bold tracking-tight">{{ isManager ? 'All reports' : 'My reports' }}</h1>
        <p class="mt-1 text-ink-500">{{ isManager ? 'Every report across the team.' : 'One report per week — your history lives here.' }}</p>
      </div>
      <div class="flex items-center gap-3">
        <select v-model="statusFilter" class="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-approved">
          <option value="">All statuses</option>
          <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ s.replace('_', ' ').toLowerCase() }}</option>
        </select>
        <NuxtLink to="/reports/new" class="bg-approved px-4 py-2 text-sm font-semibold text-white hover:bg-approved/90">
          New report
        </NuxtLink>
      </div>
    </div>

    <div class="mt-6 border border-line bg-white">
      <p v-if="loading" class="px-4 py-8 text-center text-ink-500">Loading…</p>
      <p v-else-if="reports.length === 0" class="px-4 py-8 text-center text-ink-500">
        No reports yet — start your first week with “New report”.
      </p>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left font-mono text-[11px] tracking-wider text-ink-500 uppercase">
            <th v-if="isManager" class="px-4 py-2.5 font-medium">Member</th>
            <th class="px-4 py-2.5 font-medium">Week</th>
            <th class="px-4 py-2.5 font-medium">Project</th>
            <th class="px-4 py-2.5 font-medium">Status</th>
            <th class="px-4 py-2.5 font-medium">Submitted</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="report in reports" :key="report.id" class="border-b border-line/60 last:border-0 hover:bg-paper">
            <td v-if="isManager" class="px-4 py-3 font-medium">{{ report.userName }}</td>
            <td class="px-4 py-3 tabular-nums">{{ formatWeekRange(report.weekStart, report.weekEnd) }}</td>
            <td class="px-4 py-3 text-ink-500">{{ report.projectName ?? '—' }}</td>
            <td class="px-4 py-3"><StatusTag :status="report.status" /></td>
            <td class="px-4 py-3 text-ink-500">{{ report.submittedAt ? formatDateTime(report.submittedAt) : '—' }}</td>
            <td class="px-4 py-3 text-right">
              <NuxtLink :to="`/reports/${report.id}`" class="font-medium underline decoration-approved decoration-2 underline-offset-2">
                Open
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pageCount > 1" class="mt-4 flex items-center justify-between text-sm">
      <button :disabled="page <= 1" class="border border-line px-3 py-1.5 disabled:opacity-40" @click="page--; load()">← Prev</button>
      <span class="font-mono text-xs text-ink-500">page {{ page }} / {{ pageCount }} · {{ total }} reports</span>
      <button :disabled="page >= pageCount" class="border border-line px-3 py-1.5 disabled:opacity-40" @click="page++; load()">Next →</button>
    </div>
  </div>
</template>
