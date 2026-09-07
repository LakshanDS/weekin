<script setup lang="ts">
// Page titles set per page; this suffixes the app name.
useHead({
  titleTemplate: (title) => (title ? `${title} · WeekIn` : 'WeekIn'),
})
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <AppConfirmDialog />
  </div>
</template>
