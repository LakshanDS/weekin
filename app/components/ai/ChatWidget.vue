<script setup lang="ts">
const { user } = useAuth()

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

const open = ref(false)
const draft = ref('')
const messages = ref<Msg[]>([])
const offline = ref(false)
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
    <div v-if="open" class="mb-3 flex h-[520px] w-96 max-w-[calc(100vw-2.5rem)] flex-col border border-line bg-white shadow-2xl">
      <div class="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">WeekLog assistant</p>
          <p v-if="offline" class="mt-0.5 font-mono text-[10px] text-correction">offline mode · no API key</p>
        </div>
        <div class="flex gap-2">
          <button class="cursor-pointer px-1.5 text-xs text-ink-500 hover:text-body" title="Clear conversation" @click="reset">×</button>
          <button class="cursor-pointer px-1.5 text-xs text-ink-500 hover:text-body" @click="open = false">—</button>
        </div>
      </div>

      <div ref="thread" class="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <p v-if="messages.length === 0" class="mt-8 text-center text-sm text-ink-500">
          Ask about your team's reports —<br />"What did Alice work on last week?"
        </p>
        <div v-for="(msg, i) in messages" :key="i" class="max-w-[85%] px-3 py-2 text-sm whitespace-pre-line"
          :class="msg.role === 'user' ? 'ml-auto bg-ink-900 text-white' : 'border border-line bg-paper text-body'">
          {{ msg.content }}
        </div>
        <p v-if="busy" class="font-mono text-[11px] text-draft">thinking…</p>
      </div>

      <form class="flex gap-2 border-t border-line p-3" @submit.prevent="send">
        <input v-model="draft" placeholder="Ask about the team…" class="flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-approved" />
        <button type="submit" :disabled="busy || !draft.trim()"
          class="cursor-pointer bg-approved px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>

    <button
      class="ml-auto flex size-13 cursor-pointer items-center justify-center bg-ink-900 font-display text-lg font-bold text-white shadow-xl transition-transform hover:scale-105"
      title="WeekLog assistant"
      @click="open = !open"
    >
      AI
    </button>
  </div>
</template>
