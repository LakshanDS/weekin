<script setup lang="ts">
const router = useRouter()
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="font-display text-3xl font-bold tracking-tight">New weekly report</h1>
    <p class="mt-1 text-ink-500">Same shape every week — that's what keeps the team comparable.</p>

    <div class="mt-8 border border-line bg-white p-6">
      <ReportForm @saved="(id) => router.push(`/reports/${id}`)" />
    </div>
  </div>
</template>
