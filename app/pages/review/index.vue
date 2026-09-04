<script setup lang="ts">
definePageMeta({ role: 'MANAGER' })

interface QueueRow {
  id: number
  userName: string
  projectName: string | null
  weekStart: string
  weekEnd: string
  submittedAt: string | null
}

const rows = ref<QueueRow[]>([])
const loading = ref(true)

onMounted(async () => {
  const res = await $fetch<{ reports: QueueRow[] }>('/api/reports?status=SUBMITTED&pageSize=100')
  rows.value = res.reports
  loading.value = false
})
</script>

<template>
  <div>
    <h1 class="font-display text-3xl font-bold tracking-tight">Review queue</h1>
    <p class="mt-1 text-ink-500">Submitted reports waiting for your decision.</p>

    <div class="mt-6 border border-line bg-white">
      <p v-if="loading" class="px-4 py-8 text-center text-ink-500">Loading…</p>
      <p v-else-if="rows.length === 0" class="px-4 py-8 text-center text-ink-500">
        The queue is clear — nothing waiting for review.
      </p>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left font-mono text-[11px] tracking-wider text-ink-500 uppercase">
            <th class="px-4 py-2.5 font-medium">Member</th>
            <th class="px-4 py-2.5 font-medium">Week</th>
            <th class="px-4 py-2.5 font-medium">Project</th>
            <th class="px-4 py-2.5 font-medium">Submitted</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="report in rows" :key="report.id" class="border-b border-line/60 last:border-0 hover:bg-paper">
            <td class="px-4 py-3 font-medium">{{ report.userName }}</td>
            <td class="px-4 py-3 tabular-nums">{{ formatWeekRange(report.weekStart, report.weekEnd) }}</td>
            <td class="px-4 py-3 text-ink-500">{{ report.projectName ?? '—' }}</td>
            <td class="px-4 py-3 text-ink-500">{{ report.submittedAt ? formatDateTime(report.submittedAt) : '—' }}</td>
            <td class="px-4 py-3 text-right">
              <NuxtLink :to="`/reports/${report.id}`" class="font-medium underline decoration-approved decoration-2 underline-offset-2">
                Review
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
