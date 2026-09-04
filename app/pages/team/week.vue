<script setup lang="ts">
import { mondayOf } from '#shared/utils/week'
import type { ReportStatus } from '#shared/types/report'

definePageMeta({ role: 'MANAGER' })

const week = ref(mondayOf(new Date().toISOString().slice(0, 10)))
const rows = ref<{
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
}[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  const res = await $fetch<{ members: typeof rows.value }>(`/api/team/week?week=${week.value}`)
  rows.value = res.members
  loading.value = false
}
watch(week, load)
onMounted(load)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl font-bold tracking-tight">Team week</h1>
        <p class="mt-1 text-ink-500">One week, whole team, side by side.</p>
      </div>
      <label class="flex items-center gap-2 font-mono text-[11px] tracking-widest text-ink-500 uppercase">
        Week of
        <input v-model="week" type="date" class="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-approved" />
      </label>
    </div>

    <p v-if="loading" class="mt-6 text-ink-500">Loading…</p>

    <div v-else class="mt-6 overflow-x-auto border border-line bg-white">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left font-mono text-[11px] tracking-wider text-ink-500 uppercase">
            <th class="px-4 py-2.5 font-medium">Member</th>
            <th class="px-4 py-2.5 font-medium">Report</th>
            <th class="px-4 py-2.5 font-medium">Key blocker</th>
            <th class="px-4 py-2.5 font-medium">Key achievement</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.userId" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3 font-medium">
              <NuxtLink :to="`/team/${row.userId}`" class="underline decoration-approved decoration-2 underline-offset-2">
                {{ row.name }}
              </NuxtLink>
            </td>
            <td class="px-4 py-3">
              <StatusTag v-if="row.report" :status="row.report.status" />
              <span v-else class="font-mono text-[11px] tracking-wider text-draft uppercase">Not started</span>
            </td>
            <td class="max-w-64 px-4 py-3" :class="row.report?.keyBlocker ? 'text-correction' : 'text-draft'">
              {{ row.report?.keyBlocker ?? '—' }}
            </td>
            <td class="max-w-64 px-4 py-3" :class="row.report?.keyAchievement ? 'text-approved' : 'text-draft'">
              {{ row.report?.keyAchievement ?? '—' }}
            </td>
            <td class="px-4 py-3 text-right">
              <NuxtLink v-if="row.report" :to="`/reports/${row.report.id}`" class="font-medium underline decoration-approved decoration-2 underline-offset-2">
                Open
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
