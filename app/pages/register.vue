<script setup lang="ts">
import { registerSchema } from '#shared/schemas/auth'
import { z } from 'zod'

definePageMeta({ public: true, layout: false })

const { register } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const fieldErrors = ref<Record<string, string[]>>({})
const formError = ref('')
const submitting = ref(false)

function applyApiError(err: unknown) {
  const e = err as { data?: { data?: { fieldErrors?: Record<string, string[]> }; statusMessage?: string }; statusCode?: number }
  const fields = e.data?.data?.fieldErrors
  if (fields) {
    fieldErrors.value = fields
    return
  }
  formError.value = e.statusCode === 409
    ? 'That email is already registered. Sign in instead.'
    : 'Something went wrong. Try again.'
}

async function submit() {
  formError.value = ''
  fieldErrors.value = {}

  const parsed = registerSchema.safeParse({
    name: name.value,
    email: email.value,
    password: password.value,
  })
  if (!parsed.success) {
    fieldErrors.value = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>
    return
  }

  submitting.value = true
  try {
    await register(parsed.data.name, parsed.data.email, parsed.data.password)
    await navigateTo('/', { replace: true })
  } catch (err) {
    applyApiError(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthShell variant="structure">
    <h1 class="font-display text-4xl font-bold tracking-tight text-body">Create your account</h1>
    <p class="mt-2 text-ink-500">Join the team's weekly rhythm.</p>

    <form class="mt-8 space-y-5" novalidate @submit.prevent="submit">
      <p v-if="formError" role="alert" class="border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
        {{ formError }}
      </p>

      <FormField
        v-model="name"
        label="Full name"
        name="name"
        autocomplete="name"
        placeholder="Nimal Perera"
        :error="fieldErrors.name"
      />
      <FormField
        v-model="email"
        label="Email"
        name="email"
        type="email"
        autocomplete="email"
        placeholder="you@company.com"
        :error="fieldErrors.email"
      />
      <FormField
        v-model="password"
        label="Password"
        name="password"
        type="password"
        autocomplete="new-password"
        placeholder="At least 8 characters"
        :error="fieldErrors.password"
      />

      <button
        type="submit"
        :disabled="submitting"
        class="w-full cursor-pointer bg-approved px-4 py-3 font-semibold text-white transition-colors hover:bg-approved/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ submitting ? 'Creating account…' : 'Create account' }}
      </button>
    </form>

    <p class="mt-6 text-sm text-ink-500">
      Already have an account?
      <NuxtLink to="/login" class="font-medium text-body underline decoration-approved decoration-2 underline-offset-2">
        Sign in
      </NuxtLink>
    </p>
  </AuthShell>
</template>
