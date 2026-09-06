<script setup lang="ts">
// Shown to self-registered users until a manager approves the account.
// Polls the session; flips to the workspace the moment approval lands.
definePageMeta({ layout: false })

const { user, fetchMe, logout } = useAuth()

let timer: ReturnType<typeof setInterval> | undefined

async function poll() {
  const last = user.value
  await fetchMe(true)
  // fetchMe nulls the user on any failure; keep the last known one on screen.
  user.value ??= last
  if (user.value?.status === 'ACTIVE') {
    stopPolling()
    await navigateTo('/', { replace: true })
  }
}

function stopPolling() {
  if (timer) clearInterval(timer)
  timer = undefined
}

onMounted(() => {
  timer = setInterval(poll, 5000)
})
onUnmounted(stopPolling)
</script>

<template>
  <AuthShell>
    <div class="m-auto w-full max-w-[460px] px-6 py-12 text-center">
      <p class="rise font-mono text-[11px] tracking-[0.15em] uppercase text-ink-muted">
        WeekIn · Account pending
      </p>

      <h1
        class="rise mt-3 text-[clamp(24px,2.6vw,30px)] leading-[1.08] font-bold tracking-[-0.025em]"
        style="animation-delay: 0.1s"
      >
        Almost there<span class="text-coral">.</span>
      </h1>

      <p class="rise mt-3 text-[14px] leading-[1.6] text-ink-soft" style="animation-delay: 0.2s">
        Your account is created, <b class="font-semibold text-ink">{{ user?.name }}</b> — but a manager
        has to approve you before you can enter the workspace. This page checks every few seconds and
        lets you in the moment you're approved.
      </p>

      <div
        class="rise mx-auto mt-7 flex w-fit items-center gap-2.5 rounded-full bg-ink-tint px-4 py-2"
        style="animation-delay: 0.3s"
      >
        <span class="relative flex size-2">
          <span class="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-60" />
          <span class="relative inline-flex size-2 rounded-full bg-coral" />
        </span>
        <span class="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-soft">
          Waiting for approval · {{ user?.email }}
        </span>
      </div>

      <button
        type="button"
        class="rise mt-9 cursor-pointer rounded-[10px] border border-ink-subtle px-5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-ink-tint"
        style="animation-delay: 0.4s"
        @click="logout()"
      >
        Sign out
      </button>
    </div>
  </AuthShell>
</template>
