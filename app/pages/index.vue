<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <div v-if="user" class="border border-line bg-white p-8">
    <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">
      Signed in as {{ user.role === 'MANAGER' ? 'manager' : 'team member' }}
    </p>
    <h1 class="mt-2 font-display text-3xl font-bold tracking-tight">
      Welcome, {{ user.name.split(' ')[0] }}
    </h1>
    <p class="mt-3 max-w-lg text-ink-500">
      Your {{ user.role === 'MANAGER' ? 'team dashboard is' : 'weekly report pages are' }} being built right
      now — check back as the next work block lands.
    </p>
  </div>
</template>
