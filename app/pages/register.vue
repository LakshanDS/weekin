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
    await navigateTo('/pending', { replace: true })
  } catch (err) {
    applyApiError(err)
  } finally {
    submitting.value = false
  }
}

const STEPS = [
  { n: '01', title: 'Create your account', body: "You're in as a team member in under a minute." },
  { n: '02', title: 'Your manager adds you to projects', body: "Only work you're assigned shows up in your report." },
  { n: '03', title: 'File your first report', body: 'Tasks, hours, blockers — versions and comments kept, nothing lost.' },
]

const FACTS = [
  { title: 'Tasks', body: 'Done this week, planned for the next' },
  { title: 'Hours', body: 'By project and by type' },
  { title: 'Blockers', body: "What's holding you up — and what unblocked" },
]
</script>

<template>
  <AuthShell>
    <template #aside>
      <NuxtLink
        to="/login"
        class="group font-mono text-[11px] tracking-[0.15em] uppercase text-ink-soft"
      >
        Have an account?
        <b class="font-medium text-ink group-hover:text-coral">Sign in</b>
      </NuxtLink>
    </template>

    <div class="mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-1 items-center px-8 py-12 lg:grid-cols-[1fr_1px_1fr]">
      <!-- Instructions -->
      <section class="min-w-0 pb-2 lg:pr-16">
        <p class="rise font-mono text-[11px] tracking-[0.15em] uppercase text-ink-muted">
          How WeekIn works
        </p>
        <h2
          class="rise mt-3 text-[clamp(24px,2.6vw,32px)] leading-[1.2] font-bold tracking-[-0.02em]"
          style="animation-delay: 0.1s"
        >
          One page for your week<span class="text-coral">.</span>
        </h2>
        <p class="rise mt-2 max-w-[420px] text-[15px] text-ink-soft" style="animation-delay: 0.15s">
          File your week in minutes — your manager reads one page, not a thread.
        </p>

        <ol class="rise mt-8 list-none border-t border-ink-subtle p-0" style="animation-delay: 0.2s">
          <li
            v-for="step in STEPS"
            :key="step.n"
            class="grid grid-cols-[44px_1fr] gap-2 border-b border-ink-subtle py-4"
          >
            <span class="pt-[3px] font-mono text-xs tracking-[0.08em] text-ink-muted">{{ step.n }}</span>
            <div>
              <b class="block text-[15px] font-semibold">{{ step.title }}</b>
              <span class="block text-[13.5px] text-ink-soft">{{ step.body }}</span>
            </div>
          </li>
        </ol>

        <div class="rise mt-8 grid grid-cols-1 gap-3 border-y border-ink-subtle sm:grid-cols-3 sm:gap-0" style="animation-delay: 0.3s">
          <div
            v-for="(fact, i) in FACTS"
            :key="fact.title"
            class="min-w-0 py-3.5 sm:pr-4"
            :class="i > 0 ? 'sm:border-l sm:border-ink-subtle sm:pl-4' : ''"
          >
            <b class="block text-sm font-semibold">{{ fact.title }}</b>
            <span class="block text-xs leading-[1.45] text-ink-soft">{{ fact.body }}</span>
          </div>
        </div>
      </section>

      <!-- Short divider — only alongside the content, not full-bleed -->
      <div aria-hidden="true" class="hidden h-[min(440px,58vh)] w-px justify-self-center bg-ink-subtle lg:block" />

      <!-- Form -->
      <section class="w-full min-w-0 border-t border-ink-subtle pt-8 pb-2 lg:mx-auto lg:max-w-[400px] lg:border-t-0 lg:pt-0">
        <p class="rise font-mono text-[11px] tracking-[0.15em] uppercase text-ink-muted" style="animation-delay: 0.15s">
          Get started
        </p>
        <h1
          class="rise mt-3 text-[clamp(28px,3vw,36px)] leading-[1.15] font-bold tracking-[-0.025em]"
          style="animation-delay: 0.15s"
        >
          Create your account<span class="text-coral">.</span>
        </h1>

        <form class="mt-7 grid gap-5" novalidate @submit.prevent="submit" style="animation-delay: 0.25s">
          <p v-if="formError" role="alert" class="border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
            {{ formError }}
          </p>

          <div>
            <label for="name" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Full name</label>
            <input
              id="name"
              v-model="name"
              type="text"
              name="name"
              autocomplete="name"
              placeholder="Dilini Jayawardena"
              :aria-invalid="!!fieldErrors.name"
              :aria-describedby="fieldErrors.name ? 'name-error' : undefined"
              class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-3 text-[15px] transition-colors outline-none placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint aria-invalid:border-correction aria-invalid:ring-correction/20"
            >
            <p v-if="fieldErrors.name" id="name-error" class="mt-1.5 text-sm text-correction">
              {{ fieldErrors.name[0] }}
            </p>
          </div>

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
              autocomplete="new-password"
              placeholder="At least 8 characters"
              :aria-invalid="!!fieldErrors.password"
              :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
              class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-3 text-[15px] transition-colors outline-none placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint aria-invalid:border-correction aria-invalid:ring-correction/20"
            >
            <p v-if="fieldErrors.password" id="password-error" class="mt-1.5 text-sm text-correction">
              {{ fieldErrors.password[0] }}
            </p>
            <p class="mt-1.5 text-xs text-ink-muted">
              You'll join as a team member — managers are invited from inside.
            </p>
          </div>

          <button
            type="submit"
            :disabled="submitting"
            class="mt-1 w-full cursor-pointer rounded-[10px] bg-ink px-5 py-3 font-semibold text-white transition-colors hover:bg-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ submitting ? 'Creating account…' : 'Create account' }}
          </button>
        </form>
      </section>
    </div>
  </AuthShell>
</template>
