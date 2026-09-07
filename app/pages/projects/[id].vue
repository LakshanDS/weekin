<script setup lang="ts">
definePageMeta({ role: 'MANAGER' })

const route = useRoute()
const projectId = Number(route.params.id)
useHead({ title: 'Project members' })

const { confirm } = useConfirm()

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
}

const project = ref<ProjectInfo | null>(null)
const members = ref<Member[]>([])
const loading = ref(true)
const missing = ref(false)
const error = ref('')

const allUsers = ref<{ id: number; name: string; status: string }[]>([])

async function load() {
  loading.value = true
  missing.value = false
  try {
    const [res, usersRes] = await Promise.all([
      $fetch<{ project: ProjectInfo; members: Member[] }>(`/api/projects/${projectId}/members`),
      $fetch<{ users: { id: number; name: string; status: string }[] }>('/api/users'),
    ])
    project.value = res.project
    members.value = res.members
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
    return true
  } catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    error.value = e.data?.statusMessage ?? 'Action failed.'
    return false
  }
}

// ACTIVE users not yet assigned — the add-member dropdown
const candidates = computed(() =>
  allUsers.value
    .filter((u) => u.status === 'ACTIVE' && !members.value.some((m) => m.id === u.id))
    .sort((a, b) => a.name.localeCompare(b.name)),
)
const candidateOptions = computed(() => candidates.value.map((u) => ({ value: u.id, label: u.name })))
const selectedUserId = ref<number>()

watch(candidates, (list) => {
  if (!list.some((u) => u.id === selectedUserId.value)) selectedUserId.value = list[0]?.id
}, { immediate: true })

const addMember = () =>
  run(async () => {
    if (!selectedUserId.value) return
    await $fetch(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: { userId: selectedUserId.value },
    })
    await load()
  })

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
  <div class="mx-auto flex w-full max-w-4xl flex-1 flex-col">
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
        <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">assigned</p>
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
          <form class="flex items-center gap-2" @submit.prevent="addMember">
            <AppSelect
              v-model="selectedUserId"
              class="w-44 sm:w-56"
              :options="candidateOptions"
              aria-label="Choose a member to assign"
              :disabled="candidateOptions.length === 0"
              :trigger-title="candidateOptions.length === 0 ? 'Everyone is already assigned' : 'Choose a member to assign'"
              :trigger-id="`assign-member-${projectId}`"
            />
            <button
              type="submit"
              :disabled="candidateOptions.length === 0"
              class="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add member
            </button>
          </form>
        </div>

        <div v-if="members.length" class="mt-2.5 border-y border-ink-subtle">
          <div
            v-for="member in members"
            :key="member.id"
            class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-ink-subtle px-3 py-3.5 transition-colors last:border-b-0 hover:bg-ink-tint"
          >
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
                  <NuxtLink :to="`/members/${member.id}`" class="truncate text-sm font-semibold hover:text-coral">
                    {{ member.name }}
                  </NuxtLink>
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

            <span class="flex items-center justify-end gap-2">
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
  </div>
</template>
