<script setup lang="ts">
import { loginSchema } from '#shared/schemas/auth'
import { z } from 'zod'

definePageMeta({ public: true, layout: false })

const { user, login } = useAuth()
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
    const target = user.value?.status === 'PENDING' ? '/pending' : (route.query.redirect as string) || '/'
    await navigateTo(target, { replace: true })
  } catch (err) {
    applyApiError(err)
  } finally {
    submitting.value = false
  }
}

const DEMOS = [
  { label: 'Manager', email: 'manager@demo.io' },
  { label: 'Member', email: 'alice@demo.io' },
]

function fillDemo(demoEmail: string) {
  email.value = demoEmail
  password.value = 'password123'
  fieldErrors.value = {}
}
</script>

<template>
  <AuthShell>
    <template #aside>
      <NuxtLink
        to="/register"
        class="group font-mono text-[11px] tracking-[0.15em] uppercase text-ink-soft"
      >
        New here?
        <b class="font-medium text-ink group-hover:text-coral">Create account</b>
      </NuxtLink>
    </template>

    <div class="m-auto w-full max-w-[460px] px-6 py-12">
      <p class="rise font-mono text-[11px] tracking-[0.15em] uppercase text-ink-muted">
        WeekIn · Weekly reports without the ceremony
      </p>
      <h1
        class="rise mt-3.5 text-[clamp(34px,5vw,44px)] leading-[1.1] font-bold tracking-[-0.025em]"
        style="animation-delay: 0.15s"
      >
        Welcome back<span class="text-coral">.</span>
      </h1>
      <p class="rise mt-2.5 text-[15px] text-ink-soft" style="animation-delay: 0.25s">
        Sign in to see your team's week.
      </p>

      <form class="mt-9 grid gap-5" novalidate @submit.prevent="submit" style="animation-delay: 0.35s">
        <p v-if="formError" role="alert" class="border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
          {{ formError }}
        </p>

        <div>
          <label for="email" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="you@company.com"
            :aria-invalid="!!fieldErrors.email"
            :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
            class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-3 text-[15px] transition-colors outline-none placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint aria-invalid:border-correction aria-invalid:ring-correction/20"
          >
          <p v-if="fieldErrors.email" id="email-error" class="mt-1.5 text-sm text-correction">
            {{ fieldErrors.email[0] }}
          </p>
        </div>

        <div>
          <label for="password" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :aria-invalid="!!fieldErrors.password"
            :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
            class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-3 text-[15px] transition-colors outline-none placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint aria-invalid:border-correction aria-invalid:ring-correction/20"
          >
          <p v-if="fieldErrors.password" id="password-error" class="mt-1.5 text-sm text-correction">
            {{ fieldErrors.password[0] }}
          </p>
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="mt-1 w-full cursor-pointer rounded-[10px] bg-ink px-5 py-3 font-semibold text-white transition-colors hover:bg-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <div class="rise mt-11" style="animation-delay: 0.45s">
        <p class="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-muted">
          Demo accounts · password123
        </p>
        <div class="mt-3 grid gap-2.5">
          <button
            v-for="demo in DEMOS"
            :key="demo.email"
            type="button"
            class="flex w-full cursor-pointer items-center gap-3 rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-left font-mono text-xs text-ink-soft transition-colors hover:border-[#d0d0d0] hover:bg-ink-tint"
            @click="fillDemo(demo.email)"
          >
            <span class="min-w-16 font-medium tracking-[0.12em] uppercase text-ink">{{ demo.label }}</span>
            <span class="text-ink-subtle">/</span>
            <span>{{ demo.email }}</span>
          </button>
        </div>
      </div>
    </div>
  </AuthShell>
</template>
