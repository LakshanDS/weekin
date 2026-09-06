<script setup lang="ts">
// Hours-by-type donut from the Morning Brief concept: a flat ring built from
// stroke-dasharray segments instead of the chart lib.
const props = defineProps<{ hours: Record<string, number> }>()

const COLORS: Record<string, string> = {
  development: '#242424',
  testing: '#2F6FDE',
  meetings: '#FF5757',
  documentation: '#93A1AD',
}
const LABELS: Record<string, string> = {
  development: 'Dev',
  testing: 'Testing',
  meetings: 'Meetings',
  documentation: 'Docs',
}
const colorFor = (k: string) => COLORS[k] ?? '#565656'

const entries = computed(() => {
  const known = ['development', 'testing', 'meetings', 'documentation'].filter((k) => props.hours[k])
  const extra = Object.keys(props.hours).filter((k) => !known.includes(k) && props.hours[k])
  return [...known, ...extra].map((k) => ({
    key: k,
    label: LABELS[k] ?? k,
    hours: props.hours[k],
    color: colorFor(k),
  }))
})

const total = computed(() => entries.value.reduce((sum, e) => sum + e.hours, 0))

// Each segment is a full circle with pathLength 100: dasharray shows its share,
// dashoffset shifts it to the accumulated position.
const segments = computed(() => {
  let acc = 0
  return entries.value.map((e) => {
    const pct = total.value ? (e.hours / total.value) * 100 : 0
    const seg = { color: e.color, dasharray: `${pct} ${100 - pct}`, dashoffset: -acc }
    acc += pct
    return seg
  })
})

const summary = computed(() =>
  `${total.value} hours logged: ${entries.value.map((e) => `${e.label.toLowerCase()} ${e.hours}`).join(', ')}`,
)
</script>

<template>
  <div class="flex items-center gap-6">
    <svg viewBox="0 0 180 180" class="size-[150px] shrink-0" role="img" :aria-label="summary">
      <g transform="rotate(-90 90 90)">
        <circle cx="90" cy="90" r="54" fill="none" stroke="#F5F5F5" stroke-width="24" />
        <circle
          v-for="(s, i) in segments"
          :key="i"
          cx="90"
          cy="90"
          r="54"
          fill="none"
          :stroke="s.color"
          stroke-width="24"
          pathLength="100"
          :stroke-dasharray="s.dasharray"
          :stroke-dashoffset="s.dashoffset"
        />
      </g>
      <text
        x="90"
        y="86"
        text-anchor="middle"
        font-family="Public Sans, sans-serif"
        font-weight="700"
        font-size="24"
        fill="#242424"
      >{{ total }}h</text>
      <text
        x="90"
        y="104"
        text-anchor="middle"
        font-family="IBM Plex Mono, monospace"
        font-size="9"
        letter-spacing="1.5"
        fill="#8A8A8A"
      >LOGGED</text>
    </svg>

    <div class="grid flex-1 gap-2.5">
      <div v-for="e in entries" :key="e.key" class="flex items-center gap-2.5 text-[13px] text-ink-soft">
        <span class="size-2 shrink-0 rounded-[2px]" :style="{ backgroundColor: e.color }" aria-hidden="true" />
        {{ e.label }}
        <b class="ml-auto font-mono text-xs font-medium text-ink">{{ e.hours }}h</b>
      </div>
    </div>
  </div>
</template>
