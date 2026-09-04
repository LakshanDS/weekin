<script setup lang="ts">
import type { ReportStatus } from '#shared/types/report'

definePageMeta({ role: 'MANAGER' })

const route = useRoute()
const memberId = Number(route.params.id)

interface Profile {
  member: { id: number; name: string; email: string; role: string; createdAt: string }
  stats: {
    totalReports: number
    approved: number
    needsCorrection: number
    pending: number
    tasksDone: number
    hoursLogged: number
    onTime: number
  }
  history: {
    id: number
    weekStart: string
    weekEnd: string
    status: ReportStatus
    submittedAt: string | null
    projectName: string | null
  }[]
}

const profile = ref<Profile | null>(null)
const error = ref('')

onMounted(async () => {
  try {
    profile.value = await $fetch<Profile>(`/api/team/${memberId}`)
  } catch {
    error.value = 'Member not found.'
  }
})
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <p v-if="error" class="border border-correction/40 bg-correction/10 px-4 py-3 text-correction">{{ error }}</p>

    <template v-else-if="profile">
      <NuxtLink to="/users" class="font-mono text-[11px] tracking-widest text-ink-500 uppercase hover:text-body">← All members</NuxtLink>
      <h1 class="mt-2 font-display text-3xl font-bold tracking-tight">{{ profile.member.name }}</h1>
      <p class="mt-1 text-ink-500">{{ profile.member.email }} · joined {{ new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(profile.member.createdAt)) }}</p>

      <!-- Stats -->
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="border border-line bg-white p-4">
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Reports</p>
          <p class="mt-1.5 font-display text-3xl font-bold">{{ profile.stats.totalReports }}</p>
          <p class="text-xs text-ink-500">{{ profile.stats.approved }} approved · {{ profile.stats.needsCorrection }} back · {{ profile.stats.pending }} pending</p>
        </div>
        <div class="border border-line bg-white p-4">
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">On-time rate</p>
          <p class="mt-1.5 font-display text-3xl font-bold">
            {{ profile.stats.totalReports ? Math.round((profile.stats.onTime / profile.stats.totalReports) * 100) : 0 }}%
          </p>
          <p class="text-xs text-ink-500">{{ profile.stats.onTime }} of {{ profile.stats.totalReports }} submitted by Friday</p>
        </div>
        <div class="border border-line bg-white p-4">
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Tasks done</p>
          <p class="mt-1.5 font-display text-3xl font-bold">{{ profile.stats.tasksDone }}</p>
          <p class="text-xs text-ink-500">across submitted reports</p>
        </div>
        <div class="border border-line bg-white p-4">
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Hours logged</p>
          <p class="mt-1.5 font-display text-3xl font-bold">{{ profile.stats.hoursLogged }}</p>
          <p class="text-xs text-ink-500">total, by task type</p>
        </div>
      </div>

      <!-- History -->
      <h2 class="mt-8 mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Report history</h2>
      <div class="border border-line bg-white">
        <p v-if="profile.history.length === 0" class="px-4 py-8 text-center text-ink-500">No reports yet.</p>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-line text-left font-mono text-[11px] tracking-wider text-ink-500 uppercase">
              <th class="px-4 py-2.5 font-medium">Week</th>
              <th class="px-4 py-2.5 font-medium">Project</th>
              <th class="px-4 py-2.5 font-medium">Status</th>
              <th class="px-4 py-2.5 font-medium">Submitted</th>
              <th class="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="report in profile.history" :key="report.id" class="border-b border-line/60 last:border-0 hover:bg-paper">
              <td class="px-4 py-3 tabular-nums">{{ formatWeekRange(report.weekStart, report.weekEnd) }}</td>
              <td class="px-4 py-3 text-ink-500">{{ report.projectName ?? '—' }}</td>
              <td class="px-4 py-3"><StatusTag :status="report.status" /></td>
              <td class="px-4 py-3 text-ink-500">{{ report.submittedAt ? formatDateTime(report.submittedAt) : '—' }}</td>
              <td class="px-4 py-3 text-right">
                <NuxtLink :to="`/reports/${report.id}`" class="font-medium underline decoration-approved decoration-2 underline-offset-2">Open</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
