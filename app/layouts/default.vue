<script setup lang="ts">
const { user, logout } = useAuth()
const route = useRoute()

const links = computed(() =>
  user.value?.role === 'MANAGER'
    ? [
        ['Dashboard', '/dashboard'],
        ['Review queue', '/review'],
        ['Team', '/team'],
        ['Members', '/members'],
        ['Projects', '/projects'],
        ['Reports', '/reports'],
      ]
    : [['Reports', '/reports']],
)

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)

const initials = computed(() =>
  (user.value?.name ?? '')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
const showAccount = ref(false)
const tabsStrip = ref<HTMLElement | null>(null)

// Keep the active mobile tab in view (deep links can open mid-strip).
function scrollActiveTab() {
  tabsStrip.value?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
}

function onDocumentPointerDown(e: PointerEvent) {
  if (menuOpen.value && menuRoot.value && !menuRoot.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onKeydown)
  scrollActiveTab()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeydown)
})

watch(() => route.path, () => {
  menuOpen.value = false
  scrollActiveTab()
})
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-30 border-b border-ink-subtle bg-white">
      <div class="relative mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <NuxtLink to="/" class="font-brand text-[22px] font-semibold tracking-[0.01em]">
          Week<b class="font-semibold text-coral">In</b>
        </NuxtLink>

        <nav class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 md:flex" aria-label="Primary">
          <NuxtLink
            v-for="[label, to] in links"
            :key="to"
            :to="to"
            class="border-b-2 py-1.5 font-mono text-[11px] font-semibold tracking-[0.15em] uppercase transition-colors"
            :class="isActive(to)
              ? 'border-coral text-ink'
              : 'border-transparent text-ink-soft hover:text-ink'"
            :aria-current="isActive(to) ? 'page' : undefined"
          >
            {{ label }}
          </NuxtLink>
        </nav>

        <div v-if="user" ref="menuRoot" class="relative">
          <button
            type="button"
            class="flex cursor-pointer items-center gap-3"
            :aria-expanded="menuOpen"
            aria-haspopup="menu"
            aria-label="Account menu"
            @click="menuOpen = !menuOpen"
          >
            <span class="hidden text-right leading-tight sm:block">
              <b class="block text-[13px] font-semibold">{{ user.name }}</b>
              <span class="mt-1.5 block font-mono text-[10px] tracking-[0.12em] uppercase text-ink-muted">{{ user.role }}</span>
            </span>
            <span class="flex size-8 items-center justify-center rounded-full bg-ink font-mono text-[11px] text-white" aria-hidden="true">
              {{ initials }}
            </span>
          </button>

          <div
            v-if="menuOpen"
            role="menu"
            aria-label="Account"
            class="absolute right-0 top-[calc(100%+8px)] w-40 rounded-[6px] rounded-tr-[2px] border border-ink-subtle bg-white p-1 shadow-[0_10px_30px_rgba(0,0,0,0.10)]"
          >
            <button
              type="button"
              role="menuitem"
              class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[6px] px-[5px] py-2 text-sm text-ink transition-colors hover:bg-ink-tint"
              @click="showAccount = true; menuOpen = false"
            >
              Account
              <svg class="size-4 shrink-0 text-ink-soft" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="5.25" r="2.75" stroke="currentColor" stroke-width="1.5" />
                <path d="M2.75 13.75c1-2.4 3-3.5 5.25-3.5s4.25 1.1 5.25 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[6px] px-[5px] py-2 text-sm text-coral transition-colors hover:bg-coral/10"
              @click="logout()"
            >
              Sign out
              <svg class="size-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6.5 2.5H3v11h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M10.5 5.5L13 8l-2.5 2.5M13 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile nav: scrollable tab strip, same style as the reports status tabs -->
      <nav v-if="user" class="md:hidden" aria-label="Primary">
        <div
          ref="tabsStrip"
          class="flex w-full items-center gap-x-0.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <NuxtLink
            v-for="[label, to] in links"
            :key="to"
            :to="to"
            class="shrink-0 rounded-[2px] px-2.5 py-1.5 font-mono text-[11px] font-semibold tracking-[0.15em] uppercase transition-colors"
            :class="isActive(to)
              ? 'bg-coral-tint text-ink shadow-[inset_0_-2px_0_var(--color-coral)]'
              : 'text-ink-soft hover:text-ink'"
            :aria-current="isActive(to) ? 'page' : undefined"
          >
            {{ label }}
          </NuxtLink>
        </div>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8">
      <slot />
    </main>

    <AccountModal v-if="showAccount" @close="showAccount = false" />

    <ChatWidget />
  </div>
</template>
