<script setup lang="ts">
// Hours-by-project bars from the Morning Brief concept: label + hours over a
// rounded track, fill relative to the largest project.
const props = defineProps<{ rows: { name: string; hours: number }[] }>()

const max = computed(() => Math.max(1, ...props.rows.map((r) => r.hours)))
</script>

<template>
  <div class="grid gap-3.5">
    <div v-for="r in rows" :key="r.name">
      <div class="mb-1.5 flex items-center justify-between gap-4 text-[13px] text-ink-soft">
        <span class="min-w-0 truncate">{{ r.name }}</span>
        <b class="shrink-0 font-mono text-xs font-medium text-ink">{{ r.hours }}h</b>
      </div>
      <div class="h-2 rounded-full bg-ink-tint">
        <div class="h-full rounded-full bg-ink" :style="{ width: `${(r.hours / max) * 100}%` }" />
      </div>
    </div>
  </div>
</template>
