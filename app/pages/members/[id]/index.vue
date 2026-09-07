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
useHead({ title: () => profile.value?.member.name ?? 'Member' })
const error = ref('')

onMounted(async () => {
  try {
    profile.value = await $fetch<Profile>(`/api/team/${memberId}`)
  } catch {
    error.value = 'Member not found.'
  }
})

// Same strip as the dashboard: big number, label, sub-line
const stats = computed(() => {
  const s = profile.value?.stats
  if (!s) return []
  return [
    { label: 'Reports', value: s.totalReports, sub: `${s.approved} approved · ${s.needsCorrection} back · ${s.pending} pending` },
    { label: 'On-time rate', value: `${s.totalReports ? Math.round((s.onTime / s.totalReports) * 100) : 0}%`, sub: `${s.onTime} of ${s.totalReports} submitted by Friday` },
    { label: 'Tasks done', value: s.tasksDone, sub: 'across submitted reports' },
    { label: 'Hours logged', value: s.hoursLogged, sub: 'total, by task type' },
  ]
})
</script>

<template>
  <div class="flex flex-1 flex-col">
    <p v-if="error" class="rounded-[6px] border border-correction/40 bg-correction/10 px-4 py-3 text-correction">{{ error }}</p>

    <template v-else-if="profile">
      <NuxtLink to="/members" class="font-mono text-[11px] tracking-widest text-ink-500 uppercase hover:text-body">← All members</NuxtLink>
      <h1 class="mt-2 text-3xl font-bold tracking-tight">{{ profile.member.name }}</h1>
      <p class="mt-1 text-ink-500">{{ profile.member.email }} · joined {{ new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(profile.member.createdAt)) }}</p>

      <!-- Stats -->
      <div class="mt-6 grid grid-cols-2 border-t border-ink-subtle lg:grid-cols-4">
        <div
          v-for="(s, i) in stats"
          :key="s.label"
          class="border-b border-ink-subtle py-5 pl-6 pr-6"
          :class="[i % 2 === 1 ? 'border-l' : '', i > 0 ? 'lg:border-l' : '']"
        >
          <p class="text-[40px] leading-none font-bold tracking-[-0.01em]">{{ s.value }}</p>
          <p class="mt-2.5 font-mono text-[11px] tracking-[0.15em] uppercase text-ink-muted">{{ s.label }}</p>
          <p class="mt-0.5 text-[12.5px] text-ink-soft">{{ s.sub }}</p>
        </div>
      </div>

      <!-- History -->
      <h2 class="mt-8 mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Report history</h2>
      <div v-if="profile.history.length" class="border-t border-ink-subtle">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-ink-subtle text-left font-mono text-[11px] tracking-wider text-ink-500 uppercase">
              <th class="px-4 py-2.5 font-medium">Week</th>
              <th class="px-4 py-2.5 font-medium">Project</th>
              <th class="px-4 py-2.5 font-medium">Status</th>
              <th class="px-4 py-2.5 font-medium">Submitted</th>
              <th class="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="report in profile.history"
              :key="report.id"
              class="cursor-pointer border-b border-ink-subtle transition-colors last:border-b-0 hover:bg-ink-tint"
              @click="navigateTo(`/reports/${report.id}`)"
            >
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
      <EmptyState v-else class="rise border-t border-ink-subtle" style="animation-delay: 0.2s" title="No reports yet">
        Weekly reports will land here once they're submitted.
      </EmptyState>
    </template>
  </div>
</template>
