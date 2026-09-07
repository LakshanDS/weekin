<script setup lang="ts">
const { user } = useAuth()

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

const open = ref(false)
const draft = ref('')
// App-lifetime state: survives navigating between pages, cleared on refresh.
const messages = useState<Msg[]>('ai-chat:messages', () => [])
const offline = useState('ai-chat:offline', () => false)
const busy = ref(false)
const thread = ref<HTMLElement | null>(null)

async function send() {
  const message = draft.value.trim()
  if (!message || busy.value) return
  draft.value = ''
  messages.value.push({ role: 'user', content: message })
  busy.value = true
  nextTick(scrollDown)

  try {
    const res = await $fetch<{ reply: string; offline: boolean }>('/api/ai/chat', {
      method: 'POST',
      body: {
        message,
        history: messages.value.slice(0, -1).slice(-6).map((m) => ({ role: m.role, content: m.content })),
      },
    })
    offline.value = res.offline
    messages.value.push({ role: 'assistant', content: res.reply })
  } catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    messages.value.push({ role: 'assistant', content: e.data?.statusMessage ?? 'The assistant is unavailable right now.' })
  } finally {
    busy.value = false
    nextTick(scrollDown)
  }
}

function scrollDown() {
  thread.value?.scrollTo({ top: thread.value.scrollHeight })
}

function reset() {
  messages.value = []
  offline.value = false
}
</script>

<template>
  <div v-if="user?.role === 'MANAGER'" class="fixed bottom-5 right-5 z-40 print:hidden">
    <div v-if="open" class="mb-3 flex h-[520px] w-96 max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl border border-ink-subtle bg-white shadow-[0_12px_32px_rgba(36,36,36,0.18)]">
      <div class="flex items-center justify-between border-b border-ink-subtle px-4 py-3">
        <div>
          <p class="font-mono text-[11px] tracking-[0.15em] text-ink-muted uppercase">WeekIn AI</p>
          <p v-if="offline" class="mt-0.5 font-mono text-[10px] text-correction">offline mode · no API key</p>
        </div>
        <div class="flex gap-2">
          <button class="cursor-pointer px-1.5 text-xs text-ink-soft hover:text-ink" title="Clear conversation" @click="reset">×</button>
          <button class="cursor-pointer px-1.5 text-xs text-ink-soft hover:text-ink" @click="open = false">—</button>
        </div>
      </div>

      <div ref="thread" class="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <p v-if="messages.length === 0" class="mt-8 text-center text-sm text-ink-muted">
          Ask about your team's reports —<br />"What did Alice work on last week?"
        </p>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="max-w-[85%] rounded-xl px-3 py-2 text-sm"
          :class="msg.role === 'user' ? 'ml-auto bg-ink text-white whitespace-pre-line' : 'bg-ink-tint text-ink md'"
        >
          <template v-if="msg.role === 'user'">{{ msg.content }}</template>
          <div v-else v-html="renderMarkdown(msg.content)" />
        </div>
        <p v-if="busy" class="font-mono text-[11px] text-ink-muted">thinking…</p>
      </div>

      <form class="flex gap-2 border-t border-ink-subtle p-3" @submit.prevent="send">
        <input
          v-model="draft"
          placeholder="Ask about the team…"
          class="flex-1 rounded-md border border-ink-subtle px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink"
        >
        <button
          type="submit"
          :disabled="busy || !draft.trim()"
          class="cursor-pointer rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a] disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>

    <button
      class="ml-auto flex size-13 cursor-pointer items-center justify-center rounded-2xl bg-ink text-lg font-brand font-semibold text-white shadow-[0_12px_32px_rgba(36,36,36,0.18)] transition-transform hover:scale-105"
      title="WeekIn AI"
      @click="open = !open"
    >
      AI
    </button>
  </div>
</template>

<style scoped>
.md :deep(p) { margin: 0.35em 0; }
.md :deep(p:first-child) { margin-top: 0; }
.md :deep(p:last-child) { margin-bottom: 0; }
.md :deep(.md-h3) { font-size: 1em; font-weight: 700; margin: 0.6em 0 0.2em; }
.md :deep(.md-h4) { font-size: 0.95em; font-weight: 700; margin: 0.5em 0 0.2em; }
.md :deep(.md-h5) { font-size: 0.9em; font-weight: 600; margin: 0.5em 0 0.2em; }
.md :deep(ul) { margin: 0.35em 0; padding-left: 1.1em; list-style: disc; }
.md :deep(ol) { margin: 0.35em 0; padding-left: 1.3em; list-style: decimal; }
.md :deep(li) { margin: 0.15em 0; }
.md :deep(code) { font-family: var(--font-mono); font-size: 0.85em; background: rgba(36, 36, 36, 0.08); padding: 0.1em 0.3em; border-radius: 4px; }
.md :deep(pre) { margin: 0.5em 0; padding: 0.6em 0.7em; background: rgba(36, 36, 36, 0.08); border-radius: 8px; overflow-x: auto; }
.md :deep(pre code) { background: none; padding: 0; white-space: pre; }
.md :deep(strong) { font-weight: 650; }
.md :deep(table) { display: block; margin: 0.5em 0; overflow-x: auto; border-collapse: collapse; font-size: 0.85em; }
.md :deep(th), .md :deep(td) { padding: 0.3em 0.6em 0.3em 0; border-bottom: 1px solid rgba(36, 36, 36, 0.15); text-align: left; vertical-align: top; }
.md :deep(th) { font-weight: 650; }
</style>
