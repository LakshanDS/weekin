<script setup lang="ts">
import { isoWeekOf } from '#shared/utils/week'

const route = useRoute()
const router = useRouter()

const reportId = Number(route.params.id)
useHead({ title: 'Edit report' })
const initial = ref<Awaited<ReturnType<typeof load>> | null>(null)
const missing = ref(false)

interface Detail {
  report: { projectId: number | null; projectName: string | null; assignedManagerId: number | null; weekStart: string; weekEnd: string; status: string }
  content: { tasks: never[]; nextWeekTasks: string[]; blockers: never[]; achievements: never[]; hoursByType: object; notes: string | null } | null
}

async function load() {
  const res = await $fetch<Detail>(`/api/reports/${reportId}`)
  if (res.report.status !== 'DRAFT' && res.report.status !== 'NEEDS_CORRECTION') {
    // Only drafts and needs-correction reports are editable
    await router.replace(`/reports/${reportId}`)
  }
  return {
    reportId,
    projectId: res.report.projectId,
    projectName: res.report.projectName,
    assignedManagerId: res.report.assignedManagerId,
    weekStart: res.report.weekStart,
    weekEnd: res.report.weekEnd,
    content: res.content,
  }
}

onMounted(async () => {
  try {
    initial.value = await load()
  } catch {
    missing.value = true
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-4xl">
    <!-- Briefing band -->
    <section class="flex flex-wrap items-start justify-between gap-6 pt-4 max-sm:flex-nowrap max-sm:gap-x-4">
      <div class="min-w-0 flex-1">
        <NuxtLink
          :to="`/reports/${reportId}`"
          class="rise inline-block font-mono text-[10.5px] font-bold tracking-[0.15em] uppercase text-coral-dark transition-colors hover:text-coral"
          style="animation-delay: 0.05s"
        >
          ← Back to report
        </NuxtLink>
        <h1
          class="rise mt-1 text-[18px] leading-[1.08] font-bold tracking-[-0.025em] sm:text-[clamp(24px,2.6vw,30px)]"
          style="animation-delay: 0.12s"
        >
          Update report<span class="text-coral">.</span>
        </h1>
        <p
          class="rise mt-1.5 max-w-[560px] text-[14px] leading-[1.5] text-ink-soft"
          style="animation-delay: 0.22s"
        >
          <template v-if="initial">Your edits stay private until you resubmit.</template>
          <template v-else-if="!missing">Loading the week…</template>
        </p>
      </div>
      <div v-if="initial" class="rise flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.22s">
        <p class="font-mono text-[15px] font-semibold tracking-[0.15em] uppercase text-ink">
          Week {{ isoWeekOf(initial.weekStart) }}
        </p>
        <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
          {{ formatWeekRange(initial.weekStart, initial.weekEnd) }}
        </p>
      </div>
    </section>

    <p v-if="missing" class="rise mt-8 font-mono text-sm text-correction">
      Report not found — it may have been deleted.
    </p>

    <div v-else-if="initial" class="rise mt-6 rounded-[6px] border border-ink-subtle bg-white p-6" style="animation-delay: 0.3s">
      <ReportForm :key="initial.reportId" :initial="initial" @saved="(id) => router.replace(`/reports/${id}`)" />
    </div>
  </div>
</template>
