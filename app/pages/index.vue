<script setup lang="ts">
// Landing page: send each role straight to their workspace
const { user } = useAuth()
watchEffect(() => {
  if (user.value) {
    navigateTo(user.value.role === 'MANAGER' ? '/dashboard' : '/reports', { replace: true })
  }
})
</script>

<template>
  <p class="text-ink-500">Loading your workspace…</p>
</template>
