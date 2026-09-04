<script setup lang="ts">
definePageMeta({ role: 'MANAGER' })

interface Project {
  id: number
  name: string
  description: string | null
}

const projects = ref<Project[]>([])
const loading = ref(true)
const name = ref('')
const description = ref('')
const editingId = ref<number | null>(null)
const editName = ref('')
const editDescription = ref('')
const error = ref('')

async function load() {
  loading.value = true
  const res = await $fetch<{ projects: Project[] }>('/api/projects')
  projects.value = res.projects
  loading.value = false
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

const create = () =>
  run(async () => {
    await $fetch('/api/projects', { method: 'POST', body: { name: name.value, description: description.value || null } })
    name.value = ''
    description.value = ''
    await load()
  })

const startEdit = (project: Project) => {
  editingId.value = project.id
  editName.value = project.name
  editDescription.value = project.description ?? ''
}

const saveEdit = (id: number) =>
  run(async () => {
    await $fetch(`/api/projects/${id}`, { method: 'PUT', body: { name: editName.value, description: editDescription.value || null } })
    editingId.value = null
    await load()
  })

const remove = (project: Project) =>
  run(async () => {
    await $fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    await load()
  })
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="font-display text-3xl font-bold tracking-tight">Projects</h1>
    <p class="mt-1 text-ink-500">Categories the team attaches to weekly reports.</p>

    <p v-if="error" role="alert" class="mt-4 border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
      {{ error }}
    </p>

    <!-- Create -->
    <form class="mt-6 flex flex-wrap items-end gap-3 border border-line bg-white p-4" @submit.prevent="create">
      <label class="flex-1">
        <span class="mb-1.5 block font-mono text-[11px] tracking-widest text-ink-500 uppercase">New project</span>
        <input v-model="name" placeholder="e.g. Client B Migration" class="block w-full border border-line px-3 py-2 text-sm outline-none focus:border-approved" />
      </label>
      <label class="flex-1">
        <span class="mb-1.5 block font-mono text-[11px] tracking-widest text-ink-500 uppercase">Description (optional)</span>
        <input v-model="description" placeholder="What is it about?" class="block w-full border border-line px-3 py-2 text-sm outline-none focus:border-approved" />
      </label>
      <button type="submit" class="cursor-pointer bg-approved px-4 py-2 text-sm font-semibold text-white hover:bg-approved/90">Add project</button>
    </form>

    <!-- List -->
    <div class="mt-4 border border-line bg-white">
      <p v-if="loading" class="px-4 py-8 text-center text-ink-500">Loading…</p>
      <p v-else-if="projects.length === 0" class="px-4 py-8 text-center text-ink-500">No projects yet — add the first one above.</p>
      <ul v-else>
        <li v-for="project in projects" :key="project.id" class="flex flex-wrap items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
          <template v-if="editingId === project.id">
            <input v-model="editName" class="flex-1 border border-line px-2.5 py-1.5 text-sm outline-none focus:border-approved" />
            <input v-model="editDescription" placeholder="Description" class="flex-1 border border-line px-2.5 py-1.5 text-sm outline-none focus:border-approved" />
            <button class="cursor-pointer bg-approved px-3 py-1.5 text-sm font-medium text-white" @click="saveEdit(project.id)">Save</button>
            <button class="cursor-pointer border border-line px-3 py-1.5 text-sm" @click="editingId = null">Cancel</button>
          </template>
          <template v-else>
            <div class="min-w-48 flex-1">
              <p class="text-sm font-medium">{{ project.name }}</p>
              <p v-if="project.description" class="text-xs text-ink-500">{{ project.description }}</p>
            </div>
            <button class="cursor-pointer border border-line px-3 py-1.5 text-sm hover:border-ink-500" @click="startEdit(project)">Edit</button>
            <button class="cursor-pointer border border-correction/40 px-3 py-1.5 text-sm text-correction hover:bg-correction/10" @click="remove(project)">Delete</button>
          </template>
        </li>
      </ul>
    </div>
    <p class="mt-3 font-mono text-[11px] text-draft">Deleting a project keeps its reports — they just show “No project”.</p>
  </div>
</template>
