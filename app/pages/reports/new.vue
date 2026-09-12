<script setup lang="ts">
import { isoWeekOf } from '#shared/utils/week'

// Managers review reports; authoring is a team-member-only capability.
const { user } = useAuth()
if (user.value?.role === 'MANAGER') navigateTo('/reports', { replace: true })

const router = useRouter()
const week = currentWeekRange()

useHead({ title: 'New report' })
</script>

<template>
  <div class="mx-auto w-full max-w-4xl">
    <section class="flex flex-wrap items-start justify-between gap-6 pt-4 max-sm:flex-nowrap max-sm:gap-x-4">
      <div class="min-w-0 flex-1">
        <NuxtLink
          to="/reports"
          class="rise inline-block font-mono text-[10.5px] font-bold tracking-[0.15em] uppercase text-coral-dark transition-colors hover:text-coral"
          style="animation-delay: 0.05s"
        >
          ← Back to reports
        </NuxtLink>
        <h1
          class="rise mt-1 text-[18px] leading-[1.08] font-bold tracking-[-0.025em] sm:text-[clamp(24px,2.6vw,30px)]"
          style="animation-delay: 0.12s"
        >
          New report<span class="text-coral">.</span>
        </h1>
      </div>
      <div class="rise flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.22s">
        <p class="font-mono text-[15px] font-semibold tracking-[0.15em] uppercase text-ink">
          Week {{ isoWeekOf(week.weekStart) }}
        </p>
        <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
          {{ formatWeekRange(week.weekStart, week.weekEnd) }}
        </p>
      </div>
    </section>

    <div class="rise mt-6 rounded-[6px] border border-ink-subtle bg-white p-6" style="animation-delay: 0.3s">
      <ReportForm @saved="(id) => router.replace(`/reports/${id}`)" />
    </div>
  </div>
</template>
