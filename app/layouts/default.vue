<template>
  <div class="min-h-screen">
    <header class="flex items-center justify-between border-b border-line bg-white px-5 py-3">
      <NuxtLink to="/" class="flex items-center gap-2.5">
        <WeekLogMark />
        <span class="font-display text-lg font-bold tracking-tight">WeekLog</span>
      </NuxtLink>

      <div v-if="user" class="flex items-center gap-3">
        <nav class="hidden items-center gap-4 text-sm md:flex">
          <template v-if="user.role === 'MANAGER'">
            <NuxtLink to="/dashboard" class="text-ink-500 hover:text-body">Dashboard</NuxtLink>
            <NuxtLink to="/review" class="text-ink-500 hover:text-body">Review queue</NuxtLink>
            <NuxtLink to="/team" class="text-ink-500 hover:text-body">Team</NuxtLink>
            <NuxtLink to="/members" class="text-ink-500 hover:text-body">Members</NuxtLink>
            <NuxtLink to="/projects" class="text-ink-500 hover:text-body">Projects</NuxtLink>
          </template>
          <NuxtLink to="/reports" class="text-ink-500 hover:text-body">Reports</NuxtLink>
        </nav>
        <span class="hidden text-sm text-ink-500 md:block">{{ user.name }}</span>
        <span
          class="border px-2 py-0.5 font-mono text-[11px] tracking-wide uppercase"
          :class="user.role === 'MANAGER'
            ? 'border-submitted/30 bg-submitted/10 text-submitted'
            : 'border-draft/40 bg-draft/10 text-ink-500'"
        >
          {{ user.role }}
        </span>
        <button
          class="cursor-pointer border border-line px-3 py-1.5 text-sm font-medium hover:border-ink-500"
          @click="logout()"
        >
          Sign out
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl px-5 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { user, logout } = useAuth()
</script>
