<script setup lang="ts">
defineProps<{
  label: string
  type?: string
  name: string
  autocomplete?: string
  placeholder?: string
  error?: string[] | string | undefined
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div>
    <label :for="name" class="mb-1.5 block font-mono text-[11px] tracking-widest text-ink-500 uppercase">
      {{ label }}
    </label>
    <input
      :id="name"
      v-model="model"
      :type="type ?? 'text'"
      :name="name"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${name}-error` : undefined"
      class="block w-full border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-draft focus:border-approved focus:ring-2 focus:ring-approved/25 aria-invalid:border-correction aria-invalid:ring-correction/20"
    />
    <p v-if="error" :id="`${name}-error`" class="mt-1.5 text-sm text-correction">
      {{ Array.isArray(error) ? error[0] : error }}
    </p>
  </div>
</template>
