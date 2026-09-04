<script setup lang="ts">
import { loginSchema } from '#shared/schemas/auth'
import { z } from 'zod'

definePageMeta({ public: true, layout: false })

const { login } = useAuth()
const route = useRoute()

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
  formError.value = e.statusCode === 401 ? 'Invalid email or password.' : 'Something went wrong. Try again.'
}

async function submit() {
  formError.value = ''
  fieldErrors.value = {}

  const parsed = loginSchema.safeParse({ email: email.value, password: password.value })
  if (!parsed.success) {
    fieldErrors.value = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>
    return
  }

  submitting.value = true
  try {
    await login(parsed.data.email, parsed.data.password)
    await navigateTo((route.query.redirect as string) || '/', { replace: true })
  } catch (err) {
    applyApiError(err)
  } finally {
    submitting.value = false
  }
}

const DEMOS = [
  { label: 'Manager', email: 'manager@demo.io' },
  { label: 'Team member', email: 'alice@demo.io' },
]

function fillDemo(demoEmail: string) {
  email.value = demoEmail
  password.value = 'password123'
  fieldErrors.value = {}
}
</script>

<template>
  <AuthShell variant="pipeline">
    <h1 class="font-display text-4xl font-bold tracking-tight text-body">Sign in</h1>
    <p class="mt-2 text-ink-500">Your week, on record.</p>

    <form class="mt-8 space-y-5" novalidate @submit.prevent="submit">
      <p v-if="formError" role="alert" class="border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
        {{ formError }}
      </p>

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
        autocomplete="current-password"
        placeholder="••••••••"
        :error="fieldErrors.password"
      />

      <button
        type="submit"
        :disabled="submitting"
        class="w-full cursor-pointer bg-approved px-4 py-3 font-semibold text-white transition-colors hover:bg-approved/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <div class="mt-8 border border-line bg-white p-4">
      <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">Demo accounts — click to fill</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="demo in DEMOS"
          :key="demo.email"
          type="button"
          class="cursor-pointer border border-line px-3 py-1.5 font-mono text-xs text-ink-500 transition-colors hover:border-ink-500 hover:text-body"
          @click="fillDemo(demo.email)"
        >
          {{ demo.label }} · {{ demo.email }}
        </button>
      </div>
      <p class="mt-2.5 font-mono text-xs text-draft">password123</p>
    </div>

    <p class="mt-6 text-sm text-ink-500">
      New here?
      <NuxtLink to="/register" class="font-medium text-body underline decoration-approved decoration-2 underline-offset-2">
        Create an account
      </NuxtLink>
    </p>
  </AuthShell>
</template>
