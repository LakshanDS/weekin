<script setup lang="ts">
// Shared empty state: centered in the space below the page header/filters.
// fill (default) stretches to the page bottom; :fill="false" keeps it compact
// for empty states rendered inside a bordered list.
withDefaults(defineProps<{ icon?: string; title: string; fill?: boolean }>(), {
  icon: '✓',
  fill: true,
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 py-12 text-center"
    :class="fill ? 'flex-1' : ''"
  >
    <span
      class="flex size-12 items-center justify-center rounded-full bg-ink-tint font-mono text-lg text-ink-muted"
      aria-hidden="true"
    >
      {{ icon }}
    </span>
    <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">{{ title }}</p>
    <p class="max-w-[400px] text-[14px] leading-[1.5] text-ink-soft"><slot /></p>
  </div>
</template>
