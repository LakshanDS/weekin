<script setup lang="ts">
definePageMeta({ role: 'MANAGER' })
useHead({ title: 'Members' })

const { user: me } = useAuth()
const { confirm } = useConfirm()

interface UserRow {
  id: number
  name: string
  email: string
  role: 'MEMBER' | 'MANAGER'
  status: 'PENDING' | 'ACTIVE'
  createdAt: string
}

const users = ref<UserRow[]>([])
const loading = ref(true)
const error = ref('')

const dt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ users: UserRow[] }>('/api/users')
    users.value = res.users
  } catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    error.value = e.data?.statusMessage ?? 'Could not load members.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function run(action: () => Promise<unknown>) {
  error.value = ''
  try {
    await action()
    await load()
    return true
  } catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    error.value = e.data?.statusMessage ?? 'Action failed.'
    return false
  }
}

// invite form (opens in a modal)
const showInvite = ref(false)
const form = ref({ name: '', email: '', password: '', role: 'MEMBER' as 'MEMBER' | 'MANAGER' })

function onInviteKey(e: KeyboardEvent) {
  if (e.key === 'Escape') showInvite.value = false
}

watch(showInvite, (open) => {
  if (!import.meta.client) return
  if (open) {
    window.addEventListener('keydown', onInviteKey)
    nextTick(() => document.getElementById('invite-name')?.focus())
  } else {
    window.removeEventListener('keydown', onInviteKey)
  }
})
onUnmounted(() => window.removeEventListener('keydown', onInviteKey))

const invite = () =>
  run(async () => {
    await $fetch('/api/users', { method: 'POST', body: form.value })
    form.value = { name: '', email: '', password: '', role: 'MEMBER' }
    showInvite.value = false
  })

const approve = (user: UserRow) =>
  run(() => $fetch(`/api/users/${user.id}`, { method: 'PUT', body: { status: 'ACTIVE' } }))

const setRole = (user: UserRow, role: 'MEMBER' | 'MANAGER') =>
  run(() => $fetch(`/api/users/${user.id}`, { method: 'PUT', body: { role } }))

async function remove(user: UserRow) {
  const ok = await confirm({
    title: 'Remove member',
    message: `Remove ${user.name}? Their account and all their reports will be deleted.`,
    confirmLabel: 'Remove',
    tone: 'danger',
  })
  if (ok) await run(() => $fetch(`/api/users/${user.id}`, { method: 'DELETE' }))
}

async function cancelSignup(user: UserRow) {
  const ok = await confirm({
    title: 'Discard signup',
    message: `Discard ${user.name}'s signup? Their account will be deleted and they can sign up again.`,
    confirmLabel: 'Discard',
    tone: 'danger',
  })
  if (ok) await run(() => $fetch(`/api/users/${user.id}`, { method: 'DELETE' }))
}

// --- roster filters: search + role tabs (pending signups live in their own queue) ---
// Filters live in the URL so going back from a member profile restores them.
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const role = ref<'' | 'MEMBER' | 'MANAGER'>((route.query.role as 'MEMBER' | 'MANAGER') || '')

function syncQuery() {
  const params: Record<string, string> = {}
  if (search.value.trim()) params.q = search.value.trim()
  if (role.value) params.role = role.value
  router.replace({ query: params })
}
watch([search, role], syncQuery)

const ROLE_OPTIONS: { value: '' | 'MEMBER' | 'MANAGER'; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'MEMBER', label: 'Members' },
  { value: 'MANAGER', label: 'Managers' },
]

const ROLE_SELECT_OPTIONS: { value: 'MEMBER' | 'MANAGER'; label: string }[] = [
  { value: 'MEMBER', label: 'Member' },
  { value: 'MANAGER', label: 'Manager' },
]

const roster = computed(() => users.value.filter((u) => u.status === 'ACTIVE'))
const pendingUsers = computed(() =>
  users.value.filter((u) => u.status === 'PENDING').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
)

const roleCounts = computed(() => ({
  '': roster.value.length,
  MEMBER: roster.value.filter((u) => u.role === 'MEMBER').length,
  MANAGER: roster.value.filter((u) => u.role === 'MANAGER').length,
}))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return roster.value
    .filter((u) => (!role.value || u.role === role.value) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const newestJoined = computed(() => {
  const last = [...roster.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return last ? dt.format(new Date(last.createdAt)) : '—'
})

const hasActiveFilters = computed(() => search.value.trim() !== '' || role.value !== '')

function resetFilters() {
  search.value = ''
  role.value = ''
}
</script>

<template>
  <div>
    <!-- Briefing band -->
    <section class="pt-4">
      <div class="flex flex-wrap items-start justify-between gap-6 max-sm:flex-nowrap max-sm:gap-x-4">
        <div class="min-w-0 flex-1">
          <h1
            class="rise text-[18px] sm:text-[clamp(24px,2.6vw,30px)] leading-[1.08] font-bold tracking-[-0.025em]"
            style="animation-delay: 0.12s"
          >
            Members<span class="text-coral">.</span>
          </h1>
          <p
            v-if="!loading"
            class="rise mt-1.5 max-w-[560px] text-[13px] leading-[1.5] text-ink-soft sm:text-[14px]"
            style="animation-delay: 0.22s"
          >
            <template v-if="users.length === 0">
              No accounts yet — invite your first teammate.
            </template>
            <template v-else>
              <b class="font-semibold text-ink">{{ roster.length }} people</b> are on the team —
              <b class="font-semibold text-ink">{{ roleCounts.MEMBER }} member{{ roleCounts.MEMBER > 1 ? 's' : '' }}</b> and
              <b class="font-semibold text-ink">{{ roleCounts.MANAGER }} manager{{ roleCounts.MANAGER > 1 ? 's' : '' }}</b>.
              <template v-if="pendingUsers.length">
                Plus <b class="font-semibold text-coral">{{ pendingUsers.length }} awaiting approval</b>.
              </template>
            </template>
          </p>
        </div>

        <div v-if="!loading" class="rise ml-auto flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.1s">
          <p class="font-mono text-[13px] font-semibold tracking-[0.15em] uppercase text-ink">
            {{ roster.length }} people
          </p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            <template v-if="pendingUsers.length">
              <span class="max-sm:hidden"><span class="text-coral">{{ pendingUsers.length }} awaiting approval</span> · </span>
            </template>
            {{ roleCounts.MANAGER }} manager{{ roleCounts.MANAGER > 1 ? 's' : '' }} · {{ roleCounts.MEMBER }} member{{
              roleCounts.MEMBER > 1 ? 's' : ''
            }}
          </p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            newest {{ newestJoined }}
          </p>
        </div>
      </div>
    </section>

    <p v-if="loading" class="rise mt-8 font-mono text-sm text-ink-muted">Loading members…</p>

    <template v-else>
      <!-- Filters: search · role · add member -->
      <div class="rise mt-5 flex flex-wrap items-center gap-x-3 gap-y-3" style="animation-delay: 0.3s">
        <input
          v-model="search"
          type="search"
          placeholder="Search name or email…"
          aria-label="Search members"
          class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2 text-[13.5px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint sm:w-56"
        >

        <nav
          class="flex min-w-0 flex-1 flex-nowrap items-center gap-x-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Filter by role"
        >
          <button
            v-for="opt in ROLE_OPTIONS"
            :key="opt.value"
            type="button"
            class="shrink-0 cursor-pointer rounded-[2px] px-2.5 py-1.5 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors"
            :class="role === opt.value
              ? 'bg-coral-tint text-ink shadow-[inset_0_-2px_0_var(--color-coral)]'
              : 'text-ink-soft hover:text-ink'"
            :aria-pressed="role === opt.value"
            @click="role = opt.value"
          >
            {{ opt.label }}
          </button>

          <button
            v-if="hasActiveFilters"
            type="button"
            title="Reset all filters"
            aria-label="Reset all filters"
            class="-ml-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:text-coral"
            @click="resetFilters"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3v5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </nav>

        <button
          type="button"
          class="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a]"
          @click="showInvite = true"
        >
          Add member
        </button>
      </div>

      <p v-if="error" role="alert" class="mt-4 border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
        {{ error }}
      </p>

      <!-- Pending signups awaiting approval -->
      <section v-if="pendingUsers.length" class="rise mt-6">
        <div class="flex items-baseline justify-between gap-4 px-3">
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">
            Pending approval
          </p>
          <p class="font-mono text-[11px] tracking-[0.15em] uppercase text-coral">
            {{ pendingUsers.length }} signup{{ pendingUsers.length > 1 ? 's' : '' }}
          </p>
        </div>

        <div class="mt-2.5 border-y border-ink-subtle">
          <div
            v-for="user in pendingUsers"
            :key="user.id"
            class="grid grid-cols-[minmax(0,1fr)_175px] items-center gap-x-4 gap-y-1 border-b border-ink-subtle px-3 py-3.5 transition-colors last:border-b-0 hover:bg-ink-tint sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_110px_175px]"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-coral-tint font-mono text-[10.5px] text-coral-dark"
                aria-hidden="true"
              >
                {{ initials(user.name) }}
              </span>
              <span class="min-w-0 flex-1">
                <b class="truncate text-sm font-semibold">{{ user.name }}</b>
                <span class="block truncate text-[12px] text-ink-muted sm:hidden">{{ user.email }}</span>
              </span>
            </span>

            <span class="hidden truncate text-[13px] text-ink-soft sm:block">{{ user.email }}</span>

            <span class="hidden font-mono text-xs whitespace-nowrap text-ink-muted md:block">
              {{ dt.format(new Date(user.createdAt)) }}
            </span>

            <span class="flex items-center justify-end gap-2">
              <button
                type="button"
                class="inline-flex h-7 w-24 cursor-pointer items-center justify-center rounded-[6px] bg-ink px-2.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-white transition-colors hover:bg-[#3a3a3a]"
                @click="approve(user)"
              >
                Approve
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-[6px] border border-transparent px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-correction transition-colors hover:border-correction/30 hover:bg-coral/10"
                @click="cancelSignup(user)"
              >
                Cancel
              </button>
            </span>
          </div>
        </div>
      </section>

      <!-- Roster -->
      <section class="mt-6">
        <div class="border-t border-ink-subtle">
          <div
            v-for="user in filtered"
            :key="user.id"
            class="grid grid-cols-[minmax(0,1fr)_175px] items-center gap-x-4 gap-y-1 border-b border-ink-subtle px-3 py-3.5 transition-colors hover:bg-ink-tint sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_110px_175px]"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[10.5px]"
                :class="user.role === 'MANAGER' ? 'bg-approved-tint text-approved' : 'bg-ink-tint text-ink-soft'"
                aria-hidden="true"
              >
                {{ initials(user.name) }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex min-w-0 items-center gap-2">
                  <NuxtLink
                    v-if="user.role === 'MEMBER'"
                    :to="`/members/${user.id}`"
                    class="group/name truncate text-sm font-semibold hover:text-coral"
                  >
                    {{ user.name }}
                  </NuxtLink>
                  <b v-else class="truncate text-sm font-semibold">{{ user.name }}</b>
                  <span
                    v-if="user.role === 'MANAGER'"
                    class="shrink-0 rounded-full bg-approved-tint px-2 py-0.5 font-mono text-[9.5px] tracking-[0.12em] uppercase text-approved"
                  >
                    Manager
                  </span>
                  <span
                    v-if="user.id === me?.id"
                    class="shrink-0 rounded-full bg-coral-tint px-2 py-0.5 font-mono text-[9.5px] tracking-[0.12em] uppercase text-coral-dark"
                  >
                    You
                  </span>
                </span>
                <span class="block truncate text-[12px] text-ink-muted sm:hidden">{{ user.email }}</span>
              </span>
            </span>

            <span class="hidden truncate text-[13px] text-ink-soft sm:block">{{ user.email }}</span>

            <span class="hidden font-mono text-xs whitespace-nowrap text-ink-muted md:block">
              {{ dt.format(new Date(user.createdAt)) }}
            </span>

            <span class="flex items-center justify-end gap-2">
              <AppSelect
                class="w-24 shrink-0"
                :model-value="user.role"
                :options="ROLE_SELECT_OPTIONS"
                aria-label="Change role"
                size="sm"
                :disabled="user.id === me?.id"
                :trigger-title="user.id === me?.id ? 'Your own role is locked' : 'Change role'"
                @update:model-value="(role) => setRole(user, role)"
              />
              <button
                type="button"
                :disabled="user.id === me?.id"
                :title="user.id === me?.id ? 'You cannot remove your own account' : `Remove ${user.name}`"
                class="inline-flex h-7 cursor-pointer items-center rounded-[6px] border border-transparent px-2.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-correction transition-colors enabled:hover:border-correction/30 enabled:hover:bg-coral/10 disabled:cursor-not-allowed disabled:text-ink-muted"
                @click="remove(user)"
              >
                Remove
              </button>
            </span>
          </div>
        </div>

        <p
          v-if="filtered.length === 0"
          class="border-t border-ink-subtle py-8 text-center text-sm text-ink-muted"
        >
          {{ roster.length === 0 ? 'No approved members yet.' : 'No one matches the current filters.' }}
        </p>
      </section>

      <p class="mt-3 font-mono text-[11px] text-ink-muted">
        Self-registered accounts wait above until you approve them. Removing a member deletes their
        account and every report they wrote. Your own role is locked.
      </p>
    </template>

    <!-- Invite modal -->
    <Teleport to="body">
      <div
        v-if="showInvite"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4"
        @click.self="showInvite = false"
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-label="Add member"
          class="rise w-full max-w-lg rounded-[6px] border border-ink-subtle bg-white p-6 shadow-2xl"
          @submit.prevent="invite"
        >
          <div class="flex items-start justify-between gap-4">
            <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">New account</p>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              class="-m-1 flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:text-coral"
              @click="showInvite = false"
            >
              <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <p v-if="error" role="alert" class="mt-4 border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
            {{ error }}
          </p>

          <div class="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <label for="invite-name" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Full name</label>
              <input
                id="invite-name"
                v-model="form.name"
                required
                placeholder="Jane Cooper"
                autocomplete="off"
                class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint"
              >
            </div>
            <div>
              <label for="invite-email" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Work email</label>
              <input
                id="invite-email"
                v-model="form.email"
                type="email"
                required
                placeholder="jane@company.com"
                autocomplete="off"
                class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint"
              >
            </div>
            <div>
              <label for="invite-password" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Temporary password</label>
              <input
                id="invite-password"
                v-model="form.password"
                type="password"
                required
                minlength="8"
                placeholder="At least 8 characters"
                autocomplete="new-password"
                class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint"
              >
            </div>
            <div>
              <label for="invite-role" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Role</label>
              <AppSelect
                v-model="form.role"
                :options="ROLE_SELECT_OPTIONS"
                aria-label="Role"
                trigger-id="invite-role"
                size="lg"
              />
            </div>
          </div>
          <div class="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              class="cursor-pointer rounded-[10px] border border-ink-subtle px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-ink-tint"
              @click="showInvite = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="cursor-pointer rounded-[10px] bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a]"
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>
