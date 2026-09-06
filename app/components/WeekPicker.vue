<script setup lang="ts">
import { addDaysIso, mondayOf } from '#shared/utils/week'

const week = defineModel<string>({ required: true })

// Display range end: report weeks are Mon–Fri (4), browsing weeks default Mon–Sun (6)
const props = defineProps<{ endOffset?: number; full?: boolean }>()
const endOffset = computed(() => props.endOffset ?? 6)

const calOpen = ref(false)
const calCursor = ref(new Date())
const calRoot = ref<HTMLElement | null>(null)
// Anchor left when there's room (280px popup + margin), right when the trigger
// sits near the viewport's right edge — avoids clipping on either side.
const calAlign = ref<'left' | 'right'>('left')
const pad2 = (n: number) => String(n).padStart(2, '0')
const _today = new Date()
const todayIso = `${_today.getFullYear()}-${pad2(_today.getMonth() + 1)}-${pad2(_today.getDate())}`

const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const label = computed(() => {
  const from = fmt.format(new Date(`${week.value}T00:00:00Z`))
  const to = fmt.format(new Date(`${addDaysIso(week.value, endOffset.value)}T00:00:00Z`))
  return `${from} — ${to}`
})

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(calCursor.value),
)

const cells = computed(() => {
  const y = calCursor.value.getFullYear()
  const m = calCursor.value.getMonth()
  const offset = (new Date(y, m, 1).getDay() + 6) % 7 // Monday-first offset
  const list: { iso: string; day: number; inMonth: boolean; weekStart: string; isToday: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m, 1 - offset + i)
    const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    list.push({ iso, day: d.getDate(), inMonth: d.getMonth() === m, weekStart: mondayOf(iso), isToday: iso === todayIso })
  }
  return list
})

function cellClass(cell: { iso: string; inMonth: boolean; weekStart: string; isToday: boolean }) {
  if (cell.iso === week.value) return 'bg-ink font-semibold text-white'
  if (cell.weekStart === week.value) return 'bg-coral-tint text-ink'
  if (!cell.inMonth) return 'text-ink-muted/50'
  return 'text-ink'
}

function pick(cell: { weekStart: string }) {
  week.value = cell.weekStart
  calOpen.value = false
}

function toggleCal() {
  if (!calOpen.value && calRoot.value) {
    const rect = calRoot.value.getBoundingClientRect()
    calAlign.value = rect.left + 296 <= window.innerWidth ? 'left' : 'right'
  }
  calOpen.value = !calOpen.value
}

function stepMonth(delta: number) {
  calCursor.value = new Date(calCursor.value.getFullYear(), calCursor.value.getMonth() + delta, 1)
}

function onDocPointerDown(e: PointerEvent) {
  if (calOpen.value && calRoot.value && !calRoot.value.contains(e.target as Node)) calOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') calOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="calRoot" class="relative">
    <button
      type="button"
      class="flex cursor-pointer items-center gap-2.5 rounded-[6px] border border-ink-subtle bg-white px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint"
      :class="full ? 'w-full justify-center' : ''"
      :aria-expanded="calOpen"
      aria-haspopup="dialog"
      @click="toggleCal"
    >
      <svg class="size-4 text-ink-soft" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" />
        <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      {{ label }}
    </button>

    <div
      v-if="calOpen"
      role="dialog"
      aria-label="Pick a week"
      class="absolute top-[calc(100%+8px)] z-20 w-[280px] rounded-[6px] border border-ink-subtle bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.10)]"
      :class="calAlign === 'right' ? 'right-0' : 'left-0'"
    >
      <div class="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          class="cursor-pointer px-1.5 py-0.5 text-ink-soft transition-colors hover:text-ink"
          @click="stepMonth(-1)"
        >
          <svg class="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">{{ monthLabel }}</p>
        <button
          type="button"
          aria-label="Next month"
          class="cursor-pointer px-1.5 py-0.5 text-ink-soft transition-colors hover:text-ink"
          @click="stepMonth(1)"
        >
          <svg class="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>

      <div class="mt-3 grid grid-cols-7">
        <span
          v-for="(d, i) in ['M', 'T', 'W', 'T', 'F', 'S', 'S']"
          :key="i"
          class="flex h-6 items-center justify-center font-mono text-[9.5px] tracking-[0.1em] text-ink-muted"
        >{{ d }}</span>
        <button
          v-for="cell in cells"
          :key="cell.iso"
          type="button"
          class="flex h-7 items-center justify-center text-[12.5px] transition-colors hover:bg-ink-tint"
          :class="[cellClass(cell), cell.isToday && cell.iso !== week ? 'ring-1 ring-inset ring-coral' : '']"
          @click="pick(cell)"
        >
          {{ cell.day }}
        </button>
      </div>

      <p class="mt-2 border-t border-ink-subtle pt-2 text-center font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-muted">
        Pick any day — its week loads
      </p>
    </div>
  </div>
</template>
