<script setup lang="ts">
import { changePasswordSchema, updateProfileSchema } from '#shared/schemas/auth'
import { z } from 'zod'

const emit = defineEmits<{ close: [] }>()
const { user } = useAuth()

interface AccountUser {
  id: number
  name: string
  email: string
  role: 'MEMBER' | 'MANAGER'
  status: 'PENDING' | 'ACTIVE'
  createdAt: string
}

const account = ref<AccountUser | null>(null)
const loading = ref(true)

onMounted(async () => {
  account.value = await $fetch<{ user: AccountUser }>('/api/auth/me').then((res) => res.user).catch(() => null)
  loading.value = false
})

// name row: pencil toggles the inline input; the global button below persists it
const editingName = ref(false)
const nameDraft = ref('')
const nameError = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const currentName = computed(() => account.value?.name ?? user.value?.name ?? '')
const nameChanged = computed(() => editingName.value && nameDraft.value.trim() !== currentName.value)

function startNameEdit() {
  nameDraft.value = currentName.value
  nameError.value = ''
  editingName.value = true
  nextTick(() => nameInput.value?.select())
}

function cancelNameEdit() {
  editingName.value = false
  nameError.value = ''
}

// change password form
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const fieldErrors = ref<Record<string, string[]>>({})
const formError = ref('')
const success = ref(false)
const submitting = ref(false)

const passwordTouched = computed(() => !!(currentPassword.value || newPassword.value || confirmPassword.value))
const dirty = computed(() => nameChanged.value || passwordTouched.value)

const roleLabel = computed(() => {
  const role = account.value?.role
  return role ? role[0] + role.slice(1).toLowerCase() : '—'
})

const joined = computed(() =>
  account.value
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(account.value.createdAt))
    : '',
)

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (editingName.value) cancelNameEdit()
  else emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function applyApiError(err: unknown) {
  const e = err as { data?: { data?: { fieldErrors?: Record<string, string[]> } }; statusCode?: number }
  const fields = e.data?.data?.fieldErrors
  if (fields) {
    if (fields.name) nameError.value = fields.name[0]
    else fieldErrors.value = fields
    return
  }
  formError.value = e.statusCode === 401
    ? 'Current password is incorrect.'
    : 'Something went wrong. Try again.'
}

async function submit() {
  formError.value = ''
  fieldErrors.value = {}
  nameError.value = ''
  success.value = false

  if (nameChanged.value) {
    const parsed = updateProfileSchema.safeParse({ name: nameDraft.value })
    if (!parsed.success) {
      nameError.value = z.flattenError(parsed.error).fieldErrors.name?.[0] ?? 'Enter a valid name'
      return
    }
  }

  if (passwordTouched.value) {
    if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
      formError.value = 'Fill in all three password fields to change your password.'
      return
    }
    if (confirmPassword.value !== newPassword.value) {
      fieldErrors.value = { confirmPassword: ['Passwords do not match'] }
      return
    }
    const parsed = changePasswordSchema.safeParse({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    if (!parsed.success) {
      fieldErrors.value = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>
      return
    }
  }

  if (!dirty.value) return

  submitting.value = true
  try {
    if (nameChanged.value) {
      const res = await $fetch<{ user: AccountUser }>('/api/auth/profile', {
        method: 'PUT',
        body: { name: nameDraft.value.trim() },
      })
      account.value = res.user
      if (user.value) user.value = { ...user.value, name: res.user.name }
      editingName.value = false
    }
    if (passwordTouched.value) {
      await $fetch('/api/auth/password', {
        method: 'PUT',
        body: { currentPassword: currentPassword.value, newPassword: newPassword.value },
      })
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    }
    success.value = true
  } catch (err) {
    applyApiError(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4"
      @click.self="emit('close')"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Account settings"
        class="rise w-full max-w-lg rounded-[6px] border border-ink-subtle bg-white p-6 shadow-2xl"
        novalidate
        @submit.prevent="submit"
      >
        <div class="flex items-start justify-between gap-4">
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">Account settings</p>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            class="-m-1 flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:text-coral"
            @click="emit('close')"
          >
            <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <p v-if="loading" class="mt-4 font-mono text-sm text-ink-muted">Loading account…</p>

        <template v-else>
          <!-- Profile -->
          <section class="mt-5">
            <h2 class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">Profile</h2>
            <dl class="mt-2.5 border-y border-ink-subtle">
              <div class="grid grid-cols-[110px_1fr] items-center gap-x-4 border-b border-ink-subtle py-3">
                <dt class="text-sm font-medium text-ink-soft">Name</dt>
                <dd>
                  <div v-if="!editingName" class="flex items-center justify-between gap-2">
                    <span class="truncate text-sm">{{ currentName || '—' }}</span>
                    <button
                      type="button"
                      title="Edit name"
                      aria-label="Edit name"
                      class="flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:text-coral"
                      @click="startNameEdit"
                    >
                      <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <div v-else class="flex items-center gap-1.5">
                    <input
                      ref="nameInput"
                      v-model="nameDraft"
                      type="text"
                      name="name"
                      autocomplete="name"
                      maxlength="120"
                      aria-label="Edit name"
                      :aria-invalid="!!nameError"
                      class="block w-full rounded-md border border-ink-subtle bg-white px-3 py-2 text-sm outline-none transition-colors hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint aria-invalid:border-correction aria-invalid:ring-correction/20"
                    >
                    <button
                      type="button"
                      title="Cancel"
                      aria-label="Cancel name edit"
                      class="flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:text-coral"
                      @click="cancelNameEdit"
                    >
                      <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                      </svg>
                    </button>
                  </div>
                  <p v-if="nameError" class="mt-1.5 text-sm text-correction">{{ nameError }}</p>
                </dd>
              </div>
              <div class="grid grid-cols-[110px_1fr] items-center gap-x-4 border-b border-ink-subtle py-3">
                <dt class="text-sm font-medium text-ink-soft">Email</dt>
                <dd class="truncate text-sm">{{ account?.email ?? '—' }}</dd>
              </div>
              <div class="grid grid-cols-[110px_1fr] items-center gap-x-4 border-b border-ink-subtle py-3">
                <dt class="text-sm font-medium text-ink-soft">Role</dt>
                <dd class="text-sm">{{ roleLabel }}</dd>
              </div>
              <div class="grid grid-cols-[110px_1fr] items-center gap-x-4 py-3">
                <dt class="text-sm font-medium text-ink-soft">Joined</dt>
                <dd class="text-sm">{{ joined || '—' }}</dd>
              </div>
            </dl>
          </section>

          <!-- Change password -->
          <section class="mt-5">
            <h2 class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">Change password</h2>
            <div class="mt-4 grid gap-4">
              <div>
                <label for="account-current-password" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Current password</label>
                <input
                  id="account-current-password"
                  v-model="currentPassword"
                  type="password"
                  name="currentPassword"
                  autocomplete="current-password"
                  :aria-invalid="!!fieldErrors.currentPassword"
                  :aria-describedby="fieldErrors.currentPassword ? 'account-current-password-error' : undefined"
                  class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] transition-colors outline-none placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint aria-invalid:border-correction aria-invalid:ring-correction/20"
                >
                <p v-if="fieldErrors.currentPassword" id="account-current-password-error" class="mt-1.5 text-sm text-correction">
                  {{ fieldErrors.currentPassword[0] }}
                </p>
              </div>

              <div>
                <label for="account-new-password" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">New password</label>
                <input
                  id="account-new-password"
                  v-model="newPassword"
                  type="password"
                  name="newPassword"
                  autocomplete="new-password"
                  placeholder="At least 8 characters"
                  :aria-invalid="!!fieldErrors.newPassword"
                  :aria-describedby="fieldErrors.newPassword ? 'account-new-password-error' : undefined"
                  class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] transition-colors outline-none placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint aria-invalid:border-correction aria-invalid:ring-correction/20"
                >
                <p v-if="fieldErrors.newPassword" id="account-new-password-error" class="mt-1.5 text-sm text-correction">
                  {{ fieldErrors.newPassword[0] }}
                </p>
              </div>

              <div>
                <label for="account-confirm-password" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Confirm new password</label>
                <input
                  id="account-confirm-password"
                  v-model="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  autocomplete="new-password"
                  :aria-invalid="!!fieldErrors.confirmPassword"
                  :aria-describedby="fieldErrors.confirmPassword ? 'account-confirm-password-error' : undefined"
                  class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] transition-colors outline-none placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint aria-invalid:border-correction aria-invalid:ring-correction/20"
                >
                <p v-if="fieldErrors.confirmPassword" id="account-confirm-password-error" class="mt-1.5 text-sm text-correction">
                  {{ fieldErrors.confirmPassword[0] }}
                </p>
              </div>
            </div>
          </section>

          <p v-if="formError" role="alert" class="mt-5 rounded-[6px] border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
            {{ formError }}
          </p>
          <p v-if="success" role="status" class="mt-5 rounded-[6px] border border-approved/40 bg-approved/10 px-3.5 py-2.5 text-sm text-approved">
            Settings updated.
          </p>

          <div class="mt-6 flex items-center justify-end">
            <button
              type="submit"
              :disabled="!dirty || submitting"
              class="cursor-pointer rounded-[10px] bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ submitting ? 'Saving…' : 'Update settings' }}
            </button>
          </div>
        </template>
      </form>
    </div>
  </Teleport>
</template>
