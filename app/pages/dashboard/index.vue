<script setup lang="ts">
import { mondayOf } from '#shared/utils/week'

definePageMeta({ role: 'MANAGER' })

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
    compliance: { onTime: number; late: number; pending: number; totalMembers: number }
  }
  charts: {
    weeks: string[]
    tasksDoneTrend: { week: string; done: number }[]
    statusByMember: { name: string; DRAFT: number; SUBMITTED: number; NEEDS_CORRECTION: number; APPROVED: number }[]
    hoursByProject: { name: string; hours: number }[]
    hoursByType: Record<string, number>
  }
  activity: { type: string; at: string; text: string; reportId: number }[]
}

async function load() {
  loading.value = true
  data.value = await $fetch<DashboardData>(`/api/dashboard?week=${week.value}`)
  loading.value = false
}

watch(week, load)
onMounted(load)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl font-bold tracking-tight">Team dashboard</h1>
        <p class="mt-1 text-ink-500">The week at a glance, across everyone.</p>
      </div>
      <label class="flex items-center gap-2 font-mono text-[11px] tracking-widest text-ink-500 uppercase">
        Week of
        <input v-model="week" type="date" class="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-approved" />
      </label>
    </div>

    <template v-if="data">
      <!-- Metrics -->
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="border border-line bg-white p-5">
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Submitted this week</p>
          <p class="mt-2 font-display text-4xl font-bold">{{ data.summary.totalSubmitted }}<span class="text-2xl text-draft"> +{{ data.summary.approved }}✓</span></p>
          <p class="mt-1 text-sm text-ink-500">{{ data.summary.approved }} already approved</p>
        </div>
        <div class="border border-line bg-white p-5">
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Compliance</p>
          <p class="mt-2 font-display text-4xl font-bold">
            {{ Math.round((data.summary.compliance.onTime / Math.max(1, data.summary.compliance.totalMembers)) * 100) }}%
          </p>
          <p class="mt-1 text-sm text-ink-500">
            {{ data.summary.compliance.onTime }} on time · {{ data.summary.compliance.late }} late · {{ data.summary.compliance.pending }} pending
          </p>
        </div>
        <div class="border border-line bg-white p-5">
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Needs correction</p>
          <p class="mt-2 font-display text-4xl font-bold text-correction">{{ data.summary.needsCorrection }}</p>
          <p class="mt-1 text-sm text-ink-500">reports waiting to be fixed</p>
        </div>
        <div class="border border-line bg-white p-5">
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Open blockers</p>
          <p class="mt-2 font-display text-4xl font-bold text-submitted">{{ data.summary.openBlockers }}</p>
          <p class="mt-1 text-sm text-ink-500">across unapproved reports</p>
        </div>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <!-- Charts -->
        <div class="grid gap-6">
          <div class="border border-line bg-white p-5">
            <h2 class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Tasks completed trend</h2>
            <LineChart v-if="data" :trend="data.charts.tasksDoneTrend" class="mt-4" />
          </div>
          <div class="grid gap-6 md:grid-cols-2">
            <div class="border border-line bg-white p-5">
              <h2 class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Status by member</h2>
              <StackedBar v-if="data" :rows="data.charts.statusByMember" class="mt-4" />
            </div>
            <div class="border border-line bg-white p-5">
              <h2 class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Time by task type</h2>
              <Doughnut v-if="data" :hours="data.charts.hoursByType" class="mt-4" />
            </div>
          </div>
          <div class="border border-line bg-white p-5">
            <h2 class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Hours by project</h2>
            <ProjectBar v-if="data" :rows="data.charts.hoursByProject" class="mt-4" />
          </div>
        </div>

        <!-- Activity -->
        <div class="border border-line bg-white p-5">
          <h2 class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Recent activity</h2>
          <ol class="mt-4 space-y-3">
            <li v-for="(item, i) in data.activity" :key="i" class="border-l-2 pl-3 text-sm"
              :class="item.type === 'approved' ? 'border-approved' : item.type === 'sent_back' ? 'border-correction' : 'border-submitted'">
              <NuxtLink :to="`/reports/${item.reportId}`" class="hover:underline">{{ item.text }}</NuxtLink>
              <p class="font-mono text-[11px] text-draft">{{ formatDateTime(item.at) }}</p>
            </li>
            <li v-if="data.activity.length === 0" class="text-ink-500">Nothing yet this window.</li>
          </ol>
        </div>
      </div>
    </template>
    <p v-else-if="loading" class="mt-6 text-ink-500">Loading dashboard…</p>
  </div>
</template>
