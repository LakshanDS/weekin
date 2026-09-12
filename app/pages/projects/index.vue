<script setup lang="ts">
definePageMeta({ role: 'MANAGER' })
useHead({ title: 'Projects' })

interface Project {
  id: number
  name: string
  description: string | null
  createdAt: string
  reportCount: number
  memberCount: number
}

const projects = ref<Project[]>([])
const loading = ref(true)
const error = ref('')
const { confirm } = useConfirm()

const search = ref('')

const dt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ projects: Project[] }>('/api/projects')
    projects.value = res.projects
  } catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    error.value = e.data?.statusMessage ?? 'Could not load projects.'
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

const showModal = ref(false)
const editing = ref<Project | null>(null)
const form = ref({ name: '', description: '' })

function openCreate() {
  editing.value = null
  form.value = { name: '', description: '' }
  showModal.value = true
}

function openEdit(project: Project) {
  editing.value = project
  form.value = { name: project.name, description: project.description ?? '' }
  showModal.value = true
}

function onModalKey(e: KeyboardEvent) {
  if (e.key === 'Escape') showModal.value = false
}

watch(showModal, (open) => {
  if (!import.meta.client) return
  if (open) {
    window.addEventListener('keydown', onModalKey)
    nextTick(() => document.getElementById('project-name')?.focus())
  } else {
    window.removeEventListener('keydown', onModalKey)
  }
})
onUnmounted(() => window.removeEventListener('keydown', onModalKey))

const save = () =>
  run(async () => {
    const body = { name: form.value.name, description: form.value.description || null }
    if (editing.value) {
      await $fetch(`/api/projects/${editing.value.id}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/projects', { method: 'POST', body })
    }
    showModal.value = false
    await load()
  })

async function remove(project: Project) {
  const ok = await confirm({
    title: 'Delete project',
    message: `Delete "${project.name}"? Its reports will be kept as "No project".`,
    confirmLabel: 'Delete',
    tone: 'danger',
  })
  if (ok) {
    await run(async () => {
      await $fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      await load()
    })
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return projects.value
  return projects.value.filter((p) => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q))
})

const totalReports = computed(() => projects.value.reduce((n, p) => n + p.reportCount, 0))
const unusedCount = computed(() => projects.value.filter((p) => p.reportCount === 0).length)
const newestCreated = computed(() => {
  const last = [...projects.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return last ? dt.format(new Date(last.createdAt)) : '—'
})
</script>

<template>
  <div class="flex flex-1 flex-col">
    <section class="pt-4 pb-5">
      <div class="flex flex-wrap items-start justify-between gap-6 max-sm:flex-nowrap max-sm:gap-x-4">
        <div class="min-w-0 flex-1">
          <h1
            class="rise text-[18px] sm:text-[clamp(24px,2.6vw,30px)] leading-[1.08] font-bold tracking-[-0.025em]"
            style="animation-delay: 0.12s"
          >
            Projects<span class="text-coral">.</span>
          </h1>
          <p
            v-if="!loading"
            class="rise mt-1.5 max-w-[560px] text-[13px] leading-[1.5] text-ink-soft sm:text-[14px]"
            style="animation-delay: 0.22s"
          >
            <template v-if="projects.length === 0">
              No projects yet — create the first one to start attaching reports.
            </template>
            <template v-else>
              <b class="font-semibold text-ink">{{ projects.length }} project{{ projects.length > 1 ? 's' : '' }}</b>
              {{ projects.length > 1 ? 'are' : 'is' }} open for the team,
              <b class="font-semibold text-ink">{{ totalReports }} report{{ totalReports === 1 ? '' : 's' }}</b>
              attached in total.<template v-if="unusedCount">
                <b class="font-semibold text-ink"> {{ unusedCount }}</b> {{ unusedCount > 1 ? 'have' : 'has' }} no reports yet.</template>
            </template>
          </p>
        </div>

        <div v-if="!loading" class="rise flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.1s">
          <p class="font-mono text-[13px] font-semibold tracking-[0.15em] uppercase text-ink">
            {{ projects.length }} project{{ projects.length === 1 ? '' : 's' }}
          </p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            {{ totalReports }} report{{ totalReports === 1 ? '' : 's' }} attached
          </p>
          <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
            newest {{ newestCreated }}
          </p>
        </div>
      </div>
    </section>

    <p v-if="loading" class="rise mt-8 font-mono text-sm text-ink-muted">Loading projects…</p>

    <template v-else>
      <div class="rise flex flex-wrap items-center gap-x-3 gap-y-3" style="animation-delay: 0.3s">
        <input
          v-model="search"
          type="search"
          placeholder="Search name or description…"
          aria-label="Search projects"
          class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2 text-[13.5px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint sm:w-56"
        >

        <p class="min-w-0 flex-1 font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
          {{ filtered.length }} shown
        </p>

        <button
          type="button"
          class="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a]"
          @click="openCreate"
        >
          New project
        </button>
      </div>

      <p v-if="error" role="alert" class="mt-4 rounded-[6px] border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
        {{ error }}
      </p>

      <section class="mt-6 flex flex-1 flex-col">
        <div v-if="filtered.length" class="border-t border-ink-subtle">
          <div
            v-for="project in filtered"
            :key="project.id"
            class="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-ink-subtle px-3 py-3.5 transition-colors hover:bg-ink-tint sm:grid-cols-[minmax(0,2.4fr)_105px_105px_110px_auto]"
          >
            <NuxtLink
              :to="`/projects/${project.id}`"
              class="absolute inset-0 z-0"
              :aria-label="`Manage members of ${project.name}`"
              :title="`Manage members of ${project.name}`"
            />
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold">
                {{ project.name }}
              </span>
              <span class="block truncate text-[12px] text-ink-muted">{{ project.description ?? 'No description' }}</span>
            </span>

            <span class="hidden text-[13px] text-ink-soft sm:block" title="Reports attached to this project">
              {{ project.reportCount }} report{{ project.reportCount === 1 ? '' : 's' }}
            </span>

            <span class="hidden text-[13px] text-ink-soft sm:block" title="Members assigned to this project">
              {{ project.memberCount }} member{{ project.memberCount === 1 ? '' : 's' }}
            </span>

            <span class="hidden font-mono text-xs whitespace-nowrap text-ink-muted sm:block">
              {{ dt.format(new Date(project.createdAt)) }}
            </span>

            <span class="relative z-10 flex items-center justify-end gap-2">
              <button
                type="button"
                class="inline-flex h-7 cursor-pointer items-center rounded-[6px] border border-transparent px-2.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-soft transition-colors hover:border-ink-subtle hover:text-ink"
                @click="openEdit(project)"
              >
                Edit
              </button>
              <button
                type="button"
                class="inline-flex h-7 cursor-pointer items-center rounded-[6px] border border-transparent px-2.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-correction transition-colors hover:border-correction/30 hover:bg-coral/10"
                @click="remove(project)"
              >
                Delete
              </button>
            </span>
          </div>
        </div>

        <EmptyState
          v-else-if="projects.length === 0"
          icon="+"
          class="border-t border-ink-subtle"
          title="No projects yet"
        >
          Projects are the categories the team attaches to weekly reports. Create the first one with
          the button above.
        </EmptyState>

        <EmptyState v-else class="border-t border-ink-subtle" title="No matches">
          No projects match the current search.
        </EmptyState>
      </section>
    </template>

    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4"
        @click.self="showModal = false"
      >
        <form
          role="dialog"
          aria-modal="true"
          :aria-label="editing ? 'Edit project' : 'New project'"
          class="rise w-full max-w-lg rounded-[6px] border border-ink-subtle bg-white p-6 shadow-2xl"
          @submit.prevent="save"
        >
          <div class="flex items-start justify-between gap-4">
            <p class="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-muted">
              {{ editing ? 'Edit project' : 'New project' }}
            </p>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              class="-m-1 flex size-7 shrink-0 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:text-coral"
              @click="showModal = false"
            >
              <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <p v-if="error" role="alert" class="mt-4 rounded-[6px] border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
            {{ error }}
          </p>

          <div class="mt-4 grid gap-4">
            <div>
              <label for="project-name" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Name</label>
              <input
                id="project-name"
                v-model="form.name"
                required
                placeholder="e.g. Client B Migration"
                autocomplete="off"
                class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint"
              >
            </div>
            <div>
              <label for="project-description" class="mb-2 block font-mono text-[10.5px] tracking-[0.15em] uppercase text-ink-muted">Description <span class="normal-case tracking-normal">(optional)</span></label>
              <input
                id="project-description"
                v-model="form.description"
                placeholder="What is it about?"
                autocomplete="off"
                class="block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint"
              >
            </div>
          </div>
          <div class="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              class="cursor-pointer rounded-[10px] border border-ink-subtle px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-ink-tint"
              @click="showModal = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="cursor-pointer rounded-[10px] bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a]"
            >
              {{ editing ? 'Save changes' : 'Create project' }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>
