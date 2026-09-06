<script setup lang="ts">
// Auth shell: wordmark bar, page content, hairline footer.
// Pages own their body layout (login = centered column, register = split).
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white text-ink">
    <header class="border-b border-ink-subtle">
      <div class="mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between px-8">
        <NuxtLink to="/login" class="font-brand text-[22px] font-semibold tracking-[0.01em]">
          Week<b class="font-semibold text-coral">In</b>
        </NuxtLink>
        <slot name="aside" />
      </div>
    </header>

    <main class="flex flex-1">
      <slot />
    </main>

    <footer class="border-t border-ink-subtle">
      <div class="mx-auto flex w-full max-w-[1200px] justify-between px-8 py-[18px] font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
        <span>WeekIn — weekly reports without the ceremony</span>
      </div>
    </footer>
  </div>
</template>
