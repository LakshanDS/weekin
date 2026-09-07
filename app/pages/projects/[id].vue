<script setup lang="ts">
definePageMeta({ role: 'MANAGER' })

const route = useRoute()
const projectId = Number(route.params.id)

const { confirm } = useConfirm()

const dt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

interface Member {
  id: number
  name: string
  email: string
  role: 'MEMBER' | 'MANAGER'
  createdAt: string
}

interface ProjectInfo {
  id: number
  name: string
  description: string | null
  createdAt: string
}

const project = ref<ProjectInfo | null>(null)
useHead({ title: () => project.value?.name ?? 'Project' })
const members = ref<Member[]>([])
const reportCount = ref(0)
const loading = ref(true)
const missing = ref(false)
const error = ref('')

const allUsers = ref<{ id: number; name: string; email: string; role: string; status: string }[]>([])

async function load() {
  loading.value = true
  missing.value = false
  try {
    const [res, usersRes] = await Promise.all([
      $fetch<{ project: ProjectInfo; members: Member[]; reportCount: number }>(`/api/projects/${projectId}/members`),
      $fetch<{ users: { id: number; name: string; email: string; role: string; status: string }[] }>('/api/users'),
    ])
    project.value = res.project
    members.value = res.members
    reportCount.value = res.reportCount
    allUsers.value = usersRes.users
  } catch (err) {
    const e = err as { statusCode?: number; data?: { statusMessage?: string } }
    if (e.statusCode === 404) missing.value = true
    else error.value = e.data?.statusMessage ?? 'Could not load the project.'
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

// Every ACTIVE user drives the manage-members modal; assigned ones start checked.
const allActive = computed(() =>
  allUsers.value
    .filter((u) => u.status === 'ACTIVE')
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const showAssign = ref(false)
const selectedIds = ref<number[]>([])
const assigning = ref(false)

function openAssign() {
  selectedIds.value = allUsers.value
    .filter((u) => u.status === 'ACTIVE' && members.value.some((m) => m.id === u.id))
    .map((u) => u.id)
  showAssign.value = true
}

function toggle(userId: number) {
  selectedIds.value = selectedIds.value.includes(userId)
    ? selectedIds.value.filter((id) => id !== userId)
    : [...selectedIds.value, userId]
}

const allSelected = computed(() => allActive.value.length > 0 && selectedIds.value.length === allActive.value.length)

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : allActive.value.map((u) => u.id)
}

// Diff the draft selection against the current memberships: new checks are
// added, removed checks are deleted.
async function saveAssign() {
  assigning.value = true
  const assignedIds = new Set(members.value.map((m) => m.id))
  const ops = [
    ...selectedIds.value
      .filter((id) => !assignedIds.has(id))
      .map((userId) => $fetch(`/api/projects/${projectId}/members`, { method: 'POST', body: { userId } })),
    ...[...assignedIds]
      .filter((id) => !selectedIds.value.includes(id))
      .map((userId) => $fetch(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' })),
  ]
  const results = await Promise.allSettled(ops)
  assigning.value = false
  showAssign.value = false
  const failed = results.filter((r) => r.status === 'rejected').length
  await load()
  if (failed) {
    error.value = failed === ops.length
      ? 'Could not update the member list.'
      : `${failed} of ${ops.length} changes could not be saved.`
  }
}

async function remove(member: Member) {
  const ok = await confirm({
    title: 'Remove member',
    message: `Remove ${member.name} from "${project.value?.name}"? Their reports stay on the project.`,
    confirmLabel: 'Remove',
    tone: 'danger',
  })
  if (ok) await run(() => $fetch(`/api/projects/${projectId}/members/${member.id}`, { method: 'DELETE' }))
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- Briefing band -->
    <section class="flex flex-wrap items-start justify-between gap-6 pt-4 max-sm:flex-nowrap max-sm:gap-x-4">
      <div class="min-w-0 flex-1">
        <NuxtLink
          to="/projects"
          class="rise inline-block font-mono text-[10.5px] font-bold tracking-[0.15em] uppercase text-coral-dark transition-colors hover:text-coral"
          style="animation-delay: 0.05s"
        >
          ← Back to projects
        </NuxtLink>
        <template v-if="project">
          <h1
            class="rise mt-1 text-[18px] leading-[1.08] font-bold tracking-[-0.025em] sm:text-[clamp(24px,2.6vw,30px)]"
            style="animation-delay: 0.12s"
          >
            {{ project.name }}<span class="text-coral">.</span>
          </h1>
          <p
            class="rise mt-1.5 max-w-[560px] text-[13px] leading-[1.5] text-ink-soft sm:text-[14px]"
            style="animation-delay: 0.22s"
          >
            {{ project.description ?? 'No description' }}
          </p>
        </template>
        <h1 v-else-if="!missing && !loading" class="rise mt-1 text-[18px] font-bold tracking-[-0.025em] sm:text-[clamp(24px,2.6vw,30px)]">
          Project<span class="text-coral">.</span>
        </h1>
      </div>
      <div v-if="project" class="rise flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.1s">
        <p class="font-mono text-[13px] font-semibold tracking-[0.15em] uppercase text-ink">
          {{ members.length }} member{{ members.length === 1 ? '' : 's' }}
        </p>
        <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
          {{ reportCount }} report{{ reportCount === 1 ? '' : 's' }}
        </p>
        <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
          created {{ dt.format(new Date(project.createdAt)) }}
        </p>
      </div>
    </section>

    <p v-if="loading" class="rise mt-8 font-mono text-sm text-ink-muted">Loading project…</p>

    <p v-else-if="missing" class="rise mt-8 font-mono text-sm text-correction">
      Project not found — it may have been deleted.
    </p>

    <template v-else>
      <p v-if="error" role="alert" class="mt-4 rounded-[6px] border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
        {{ error }}
      </p>

      <!-- Assigned members -->
      <section class="mt-6 flex flex-1 flex-col">
        <div class="rise flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-3" style="animation-delay: 0.3s">
          <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink">
            Assigned members
          </p>
          <button
            type="button"
            class="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a]"
            title="Assign or remove members of this project"
            @click="openAssign"
          >
            Manage members
          </button>
        </div>

        <div v-if="members.length" class="mt-2.5 border-y border-ink-subtle">
          <div
            v-for="member in members"
            :key="member.id"
            class="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-ink-subtle px-3 py-3.5 transition-colors last:border-b-0 hover:bg-ink-tint"
          >
            <NuxtLink
              :to="`/members/${member.id}`"
              class="absolute inset-0 z-0"
              :aria-label="`Open ${member.name}'s profile`"
              :title="`Open ${member.name}'s profile`"
            />
            <span class="flex min-w-0 items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[10.5px]"
                :class="member.role === 'MANAGER' ? 'bg-approved-tint text-approved' : 'bg-ink-tint text-ink-soft'"
                aria-hidden="true"
              >
                {{ initials(member.name) }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex min-w-0 items-center gap-2">
                  <span class="truncate text-sm font-semibold">{{ member.name }}</span>
                  <span
                    v-if="member.role === 'MANAGER'"
                    class="shrink-0 rounded-full bg-approved-tint px-2 py-0.5 font-mono text-[9.5px] tracking-[0.12em] uppercase text-approved"
                  >
                    Manager
                  </span>
                </span>
                <span class="block truncate text-[12px] text-ink-muted">{{ member.email }}</span>
              </span>
            </span>

            <span class="relative z-10 flex items-center justify-end gap-2">
              <button
                type="button"
                class="inline-flex h-7 cursor-pointer items-center rounded-[6px] border border-transparent px-2.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-correction transition-colors hover:border-correction/30 hover:bg-coral/10"
                @click="remove(member)"
              >
                Remove
              </button>
            </span>
          </div>
        </div>

        <EmptyState v-else class="mt-2.5 border-y border-ink-subtle" title="No members yet">
          Assign members above — the report form only offers projects a member is assigned to.
        </EmptyState>

        <p class="mt-3 font-mono text-[11px] text-ink-muted">
          Members can only attach new reports to projects they are assigned to. Removing someone
          keeps their existing reports; they just can't pick this project going forward.
        </p>
      </section>
    </template>

    <!-- Assign users modal -->
    <Teleport to="body">
      <div
        v-if="showAssign"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4"
        @click.self="showAssign = false"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Assign users"
          class="rise flex max-h-[80vh] w-full max-w-lg flex-col rounded-[6px] border border-ink-subtle bg-white shadow-2xl"
        >
          <div class="flex items-start justify-between gap-4 p-6 pb-4">
            <div>
              <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">Manage members</p>
              <p class="mt-1 text-sm text-ink-soft">Checked users are assigned to “{{ project?.name }}” — uncheck to remove.</p>
            </div>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              class="-m-1 flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:text-coral"
              @click="showAssign = false"
            >
              <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto border-y border-ink-subtle">
            <label
              v-for="user in allActive"
              :key="user.id"
              class="flex cursor-pointer items-center gap-3 border-b border-ink-subtle px-6 py-3 transition-colors last:border-b-0 hover:bg-ink-tint"
            >
              <input
                type="checkbox"
                class="size-4 cursor-pointer accent-coral"
                :checked="selectedIds.includes(user.id)"
                @change="toggle(user.id)"
              >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ user.name }}</span>
                <span class="block truncate text-[12px] text-ink-muted">{{ user.email }}</span>
              </span>
              <span
                v-if="user.role === 'MANAGER'"
                class="shrink-0 rounded-full bg-approved-tint px-2 py-0.5 font-mono text-[9.5px] tracking-[0.12em] uppercase text-approved"
              >
                Manager
              </span>
            </label>
            <p v-if="allActive.length === 0" class="px-6 py-8 text-center text-sm text-ink-muted">
              No active users yet — invite members from the Members page first.
            </p>
          </div>

          <div class="flex items-center justify-between gap-4 p-6">
            <div class="flex items-center gap-4">
              <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
                {{ selectedIds.length }} of {{ allActive.length }} assigned
              </p>
              <button
                type="button"
                :disabled="allActive.length === 0"
                class="cursor-pointer font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-soft transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                @click="toggleAll"
              >
                {{ allSelected ? 'Clear all' : 'Select all' }}
              </button>
            </div>
            <button
              type="button"
              :disabled="assigning"
              class="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-50"
              @click="saveAssign"
            >
              {{ assigning ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
