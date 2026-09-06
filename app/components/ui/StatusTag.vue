<script setup lang="ts">
import type { ReportStatus } from '#shared/types/report'

const props = defineProps<{
  status: ReportStatus
  // 'dark' renders on the ink panel, 'light' on the paper UI
  tone?: 'dark' | 'light'
  // tighter padding + type for cramped rows (mobile queue)
  compact?: boolean
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
    dark: 'bg-white/10 text-slate-300',
    light: 'bg-draft/15 text-ink-soft',
  },
  SUBMITTED: {
    dark: 'bg-submitted/20 text-[#9dc0f7]',
    light: 'bg-submitted/10 text-submitted',
  },
  NEEDS_CORRECTION: {
    dark: 'bg-correction/20 text-[#f2b964]',
    light: 'bg-correction/10 text-correction',
  },
  APPROVED: {
    dark: 'bg-approved/25 text-[#8fd8b8]',
    light: 'bg-approved/10 text-approved',
  },
}

const classes = computed(() => STYLES[props.status][props.tone ?? 'light'])
</script>

<template>
  <span
    class="inline-flex items-center rounded-full font-mono uppercase"
    :class="[classes, compact ? 'gap-1 px-2 py-0.5 text-[9.5px] tracking-[0.1em]' : 'gap-1.5 px-2.5 py-1 text-[10.5px] tracking-[0.12em]']"
  >
    <span class="rounded-full bg-current" :class="compact ? 'size-1' : 'size-1.5'" />
    {{ LABELS[status] }}
  </span>
</template>
