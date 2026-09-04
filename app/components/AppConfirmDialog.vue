<script setup lang="ts">
const { state, answer } = useConfirm()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') answer(false)
}

watch(
  () => state.value.options,
  (options) => {
    if (import.meta.client) {
      if (options) {
        window.addEventListener('keydown', onKey)
        nextTick(() => document.getElementById('confirm-cancel')?.focus())
      } else {
        window.removeEventListener('keydown', onKey)
      }
    }
  },
)

onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.options"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4"
      @click.self="answer(false)"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        :aria-label="state.options.title"
        class="w-full max-w-md border border-line bg-white p-6 shadow-2xl"
      >
        <p
          class="font-mono text-[11px] tracking-widest uppercase"
          :class="state.options.tone === 'danger' ? 'text-correction' : 'text-ink-500'"
        >
          {{ state.options.title }}
        </p>
        <p class="mt-2.5 text-[15px] leading-relaxed text-body">{{ state.options.message }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button
            id="confirm-cancel"
            class="cursor-pointer border border-line px-4 py-2 text-sm font-medium hover:border-ink-500"
            @click="answer(false)"
          >
            Cancel
          </button>
          <button
            class="cursor-pointer px-4 py-2 text-sm font-semibold text-white"
            :class="state.options.tone === 'danger' ? 'bg-correction hover:bg-correction/90' : 'bg-approved hover:bg-approved/90'"
            @click="answer(true)"
          >
            {{ state.options.confirmLabel ?? 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
