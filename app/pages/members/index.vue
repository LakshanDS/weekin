<script setup lang="ts">
definePageMeta({ role: 'MANAGER' })

const { user: me } = useAuth()

interface UserRow {
  id: number
  name: string
  email: string
  role: 'MEMBER' | 'MANAGER'
  createdAt: string
}

const users = ref<UserRow[]>([])
const loading = ref(true)
const error = ref('')

// invite form
const showInvite = ref(false)
const form = ref({ name: '', email: '', password: '', role: 'MEMBER' as 'MEMBER' | 'MANAGER' })

async function load() {
  loading.value = true
  const res = await $fetch<{ users: UserRow[] }>('/api/users')
  users.value = res.users
  loading.value = false
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

const invite = () =>
  run(async () => {
    await $fetch('/api/users', { method: 'POST', body: form.value })
    form.value = { name: '', email: '', password: '', role: 'MEMBER' }
    showInvite.value = false
  })

const setRole = (user: UserRow, role: 'MEMBER' | 'MANAGER') =>
  run(() => $fetch(`/api/users/${user.id}`, { method: 'PUT', body: { role } }))

const remove = (user: UserRow) => {
  if (!window.confirm(`Remove ${user.name}? Their account and all their reports will be deleted.`)) return false
  return run(() => $fetch(`/api/users/${user.id}`, { method: 'DELETE' }))
}

const dt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl font-bold tracking-tight">Team members</h1>
        <p class="mt-1 text-ink-500">Accounts, roles and access.</p>
      </div>
      <button class="cursor-pointer bg-approved px-4 py-2 text-sm font-semibold text-white hover:bg-approved/90" @click="showInvite = !showInvite">
        {{ showInvite ? 'Close' : 'Add member' }}
      </button>
    </div>

    <p v-if="error" role="alert" class="mt-4 border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
      {{ error }}
    </p>

    <form v-if="showInvite" class="mt-4 grid gap-3 border border-line bg-white p-4 sm:grid-cols-4" @submit.prevent="invite">
      <input v-model="form.name" placeholder="Full name" class="border border-line px-3 py-2 text-sm outline-none focus:border-approved" />
      <input v-model="form.email" type="email" placeholder="email@company.com" class="border border-line px-3 py-2 text-sm outline-none focus:border-approved" />
      <input v-model="form.password" type="password" placeholder="Temp password (8+)" class="border border-line px-3 py-2 text-sm outline-none focus:border-approved" />
      <div class="flex gap-2">
        <select v-model="form.role" class="flex-1 border border-line bg-white px-2 py-2 text-sm outline-none focus:border-approved">
          <option value="MEMBER">Member</option>
          <option value="MANAGER">Manager</option>
        </select>
        <button type="submit" class="cursor-pointer border border-approved bg-approved/10 px-3 py-2 text-sm font-medium text-approved">Create</button>
      </div>
    </form>

    <div class="mt-6 border border-line bg-white">
      <p v-if="loading" class="px-4 py-8 text-center text-ink-500">Loading…</p>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left font-mono text-[11px] tracking-wider text-ink-500 uppercase">
            <th class="px-4 py-2.5 font-medium">Name</th>
            <th class="px-4 py-2.5 font-medium">Email</th>
            <th class="px-4 py-2.5 font-medium">Role</th>
            <th class="px-4 py-2.5 font-medium">Joined</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3 font-medium">
              <NuxtLink v-if="user.role === 'MEMBER'" :to="`/members/${user.id}`" class="underline decoration-approved decoration-2 underline-offset-2">
                {{ user.name }}
              </NuxtLink>
              <span v-else>{{ user.name }}</span>
            </td>
            <td class="px-4 py-3 text-ink-500">{{ user.email }}</td>
            <td class="px-4 py-3">
              <select
                :value="user.role"
                :disabled="user.id === me?.id"
                class="border border-line bg-white px-2 py-1 text-xs outline-none focus:border-approved disabled:opacity-50"
                @change="setRole(user, ($event.target as HTMLSelectElement).value as 'MEMBER' | 'MANAGER')"
              >
                <option value="MEMBER">Member</option>
                <option value="MANAGER">Manager</option>
              </select>
            </td>
            <td class="px-4 py-3 text-ink-500">{{ dt.format(new Date(user.createdAt)) }}</td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="user.id !== me?.id"
                class="cursor-pointer border border-correction/40 px-3 py-1.5 text-xs text-correction hover:bg-correction/10"
                @click="remove(user)"
              >
                Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-3 font-mono text-[11px] text-draft">Removing a member deletes their account and reports. Your own role is locked.</p>
  </div>
</template>
