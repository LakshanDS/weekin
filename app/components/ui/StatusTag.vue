<script setup lang="ts">
import type { ReportStatus } from '#shared/types/report'

const props = defineProps<{
  status: ReportStatus
  // 'dark' renders on the ink panel, 'light' on the paper UI
  tone?: 'dark' | 'light'
}>()

const LABELS: Record<ReportStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  NEEDS_CORRECTION: 'Needs correction',
  APPROVED: 'Approved',
}

// Static class strings so Tailwind can see them.
const STYLES: Record<ReportStatus, Record<'dark' | 'light', string>> = {
  DRAFT: {
    dark: 'border-white/25 bg-white/10 text-slate-300',
    light: 'border-draft/40 bg-draft/10 text-ink-500',
  },
  SUBMITTED: {
    dark: 'border-submitted/50 bg-submitted/20 text-[#9dc0f7]',
    light: 'border-submitted/30 bg-submitted/10 text-submitted',
  },
  NEEDS_CORRECTION: {
    dark: 'border-correction/50 bg-correction/20 text-[#f2b964]',
    light: 'border-correction/30 bg-correction/10 text-correction',
  },
  APPROVED: {
    dark: 'border-approved/50 bg-approved/25 text-[#8fd8b8]',
    light: 'border-approved/30 bg-approved/10 text-approved',
  },
}

const classes = computed(() => STYLES[props.status][props.tone ?? 'light'])
</script>

<template>
  <span class="inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] tracking-wide uppercase" :class="classes">
    <span class="size-1.5 rounded-full bg-current" />
    {{ LABELS[status] }}
  </span>
</template>
