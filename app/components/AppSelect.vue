<script setup lang="ts" generic="T extends string | number">
// Custom dropdown mirroring the WeekPicker popup: button trigger, floating
// 6px-corner card, closes on outside click / Escape. Width comes from the parent.
const props = withDefaults(
  defineProps<{
    options: { value: T; label: string }[]
    ariaLabel: string
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    triggerId?: string
    triggerTitle?: string
  }>(),
  { size: 'md' },
)

const model = defineModel<T>({ required: true })

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const selected = computed(() => props.options.find((o) => o.value === model.value))

const TRIGGER_SIZES = {
  sm: 'h-7 rounded-[6px] px-2.5 text-[13px] font-medium',
  md: 'rounded-md py-2 pl-3 pr-3 text-[13px] font-medium',
  lg: 'rounded-md py-2.5 pl-3.5 pr-3 text-[15px]',
} as const

function pick(value: T) {
  if (value !== model.value) model.value = value
  open.value = false
}

function onDocPointerDown(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
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
  <div ref="root" class="relative">
    <button
      :id="triggerId"
      type="button"
      :title="triggerTitle"
      :disabled="disabled"
      class="flex w-full cursor-pointer items-center justify-between gap-2 border border-ink-subtle bg-white text-ink outline-none transition-colors hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint disabled:cursor-not-allowed disabled:opacity-50"
      :class="TRIGGER_SIZES[size]"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="ariaLabel"
      @click="open = !open"
    >
      <span class="truncate">{{ selected?.label }}</span>
      <svg class="size-2.5 shrink-0 text-ink-soft" viewBox="0 0 10 6" fill="none" aria-hidden="true">
        <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div
      v-if="open"
      role="listbox"
      :aria-label="ariaLabel"
      class="absolute left-0 top-[calc(100%+6px)] z-20 w-full rounded-[6px] border border-ink-subtle bg-white p-1 shadow-[0_10px_30px_rgba(0,0,0,0.10)]"
    >
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        role="option"
        :aria-selected="opt.value === model"
        :title="opt.label"
        class="block w-full cursor-pointer truncate rounded-[4px] px-3 py-1.5 text-left text-[13px] transition-colors"
        :class="opt.value === model ? 'bg-ink-tint font-semibold text-ink' : 'text-ink hover:bg-ink-tint'"
        @click="pick(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
