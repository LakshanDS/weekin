<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const reportId = Number(route.params.id)
const initial = ref<Awaited<ReturnType<typeof load>> | null>(null)

interface Detail {
  report: { projectId: number | null; weekStart: string; weekEnd: string; status: string }
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
    weekStart: res.report.weekStart,
    weekEnd: res.report.weekEnd,
    content: res.content,
  }
}

onMounted(async () => {
  initial.value = await load()
})
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="font-display text-3xl font-bold tracking-tight">Edit report</h1>
    <p class="mt-1 text-ink-500">
      {{ initial ? formatWeekRange(initial.weekStart, initial.weekEnd) : '' }}
    </p>

    <div v-if="initial" class="mt-8 border border-line bg-white p-6">
      <ReportForm :key="initial.reportId" :initial="initial" @saved="(id) => router.push(`/reports/${id}`)" />
    </div>
  </div>
</template>
