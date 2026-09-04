<script setup lang="ts">
import type { ReportContent as ReportContentType, ReportStatus } from '#shared/types/report'

const route = useRoute()
const reportId = Number(route.params.id)
const { user } = useAuth()
const { confirm } = useConfirm()
const isManager = computed(() => user.value?.role === 'MANAGER')
const isOwner = computed(() => detail.value?.report.userId === user.value?.id)

interface CommentRow {
  id: number
  action: 'REQUEST_CHANGES' | 'APPROVE'
  comment: string | null
  createdAt: string
  versionNo: number
  managerName: string
}

interface Detail {
  report: {
    id: number
    userId: number
    userName: string
    projectName: string | null
    weekStart: string
    weekEnd: string
    status: ReportStatus
    submittedAt: string | null
  }
  content: (ReportContentType & { versionId: number; versionNo: number; isDraftContent: boolean }) | null
  comments: CommentRow[]
  versions: { id: number; versionNo: number; submittedAt: string | null; createdAt: string }[]
}

const detail = ref<Detail | null>(null)
const error = ref('')

// Version viewer: 'current' = what the API returns for this viewer, or a version id
const selectedVersionId = ref<number | 'current'>('current')
const versionContent = ref<ReportContentType | null>(null)

async function load() {
  try {
    detail.value = await $fetch<Detail>(`/api/reports/${reportId}`)
  } catch {
    error.value = 'Report not found.'
  }
}
await load()

const shownContent = computed(() => (selectedVersionId.value === 'current' ? detail.value?.content ?? null : versionContent.value))

async function viewVersion(id: number) {
  if (selectedVersionId.value === id) return
  const versions = await $fetch<{ versions: (ReportContentType & { id: number; versionNo: number; submittedAt: string | null })[] }>(
    `/api/reports/${reportId}/versions`,
  )
  const match = versions.versions.find((v) => v.id === id)
  if (match) {
    versionContent.value = match
    selectedVersionId.value = id
  }
}

// --- actions ---
const busy = ref(false)
const actionError = ref('')
const showRequestChanges = ref(false)
const changeComment = ref('')

async function run(action: () => Promise<unknown>) {
  busy.value = true
  actionError.value = ''
  try {
    await action()
    selectedVersionId.value = 'current'
    await load()
  } catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    actionError.value = e.data?.statusMessage ?? 'Action failed. Try again.'
  } finally {
    busy.value = false
  }
}

const submit = () => run(() => $fetch(`/api/reports/${reportId}/submit`, { method: 'POST' }))
const approve = () => run(() => $fetch(`/api/reports/${reportId}/approve`, { method: 'POST', body: {} }))
const requestChanges = () =>
  run(() =>
    $fetch(`/api/reports/${reportId}/request-changes`, { method: 'POST', body: { comment: changeComment.value.trim() } }),
  ).then(() => {
    showRequestChanges.value = false
    changeComment.value = ''
  })

async function deleteReport() {
  const ok = await confirm({
    title: 'Delete report',
    message: 'Delete this report? This cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
  })
  if (ok) await run(() => $fetch(`/api/reports/${reportId}`, { method: 'DELETE' })).then(() => navigateTo('/reports'))
}

const latestCorrection = computed(() =>
  detail.value?.comments.filter((c) => c.action === 'REQUEST_CHANGES').at(-1),
)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <p v-if="error" class="border border-correction/40 bg-correction/10 px-4 py-3 text-correction">{{ error }}</p>

    <template v-else-if="detail">
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="font-mono text-[11px] tracking-widest text-ink-500 uppercase">
            Weekly report · {{ isManager && !isOwner ? detail.report.userName : 'your week' }}
          </p>
          <h1 class="mt-1 font-display text-3xl font-bold tracking-tight">
            {{ formatWeekRange(detail.report.weekStart, detail.report.weekEnd) }}
          </h1>
          <p class="mt-1 text-sm text-ink-500">{{ detail.report.projectName ?? 'No project' }}</p>
        </div>
        <StatusTag :status="detail.report.status" />
      </div>

      <!-- Correction banner for the owner -->
      <div v-if="isOwner && detail.report.status === 'NEEDS_CORRECTION' && latestCorrection" class="mt-6 border border-correction/40 bg-correction/10 px-4 py-3">
        <p class="font-mono text-[11px] tracking-widest text-correction uppercase">Sent back — fix and resubmit</p>
        <p class="mt-1.5 text-sm">“{{ latestCorrection.comment }}” — {{ latestCorrection.managerName }}</p>
      </div>

      <!-- Draft-in-progress note for the owner -->
      <p v-if="isOwner && detail.content?.isDraftContent && detail.report.status === 'NEEDS_CORRECTION'" class="mt-4 font-mono text-[11px] text-ink-500">
        You have unsaved-to-review edits in progress (version {{ detail.content.versionNo }}). Submit when ready.
      </p>

      <!-- Actions -->
      <div class="mt-6 flex flex-wrap items-center gap-3">
        <template v-if="isOwner && (detail.report.status === 'DRAFT' || detail.report.status === 'NEEDS_CORRECTION')">
          <NuxtLink :to="`/reports/${reportId}/edit`" class="border border-line bg-white px-4 py-2 text-sm font-medium hover:border-ink-500">
            Edit report
          </NuxtLink>
          <button :disabled="busy" class="cursor-pointer bg-approved px-4 py-2 text-sm font-semibold text-white hover:bg-approved/90 disabled:opacity-60"
            @click="detail.report.status === 'DRAFT' ? submit() : submit()">
            {{ detail.report.status === 'DRAFT' ? 'Submit for review' : 'Resubmit' }}
          </button>
        </template>

        <template v-if="isManager && detail.report.status === 'SUBMITTED'">
          <button :disabled="busy" class="cursor-pointer bg-approved px-4 py-2 text-sm font-semibold text-white hover:bg-approved/90 disabled:opacity-60" @click="approve()">
            Approve
          </button>
          <button :disabled="busy" class="cursor-pointer border border-correction/50 bg-correction/10 px-4 py-2 text-sm font-semibold text-correction hover:bg-correction/20 disabled:opacity-60"
            @click="showRequestChanges = !showRequestChanges">
            Request changes
          </button>
        </template>

        <NuxtLink v-if="isOwner && (detail.report.status === 'DRAFT' || detail.report.status === 'NEEDS_CORRECTION')"
          href="#" class="cursor-pointer text-sm text-correction hover:underline"
          @click.prevent="deleteReport()">
          Delete
        </NuxtLink>
      </div>

      <!-- Request-changes comment box -->
      <div v-if="showRequestChanges" class="mt-4 border border-correction/40 bg-white p-4">
        <label class="mb-1.5 block font-mono text-[11px] tracking-widest text-correction uppercase">
          What needs to change? (sent to {{ detail.report.userName }})
        </label>
        <textarea v-model="changeComment" rows="3" placeholder="Describe the corrections needed…"
          class="block w-full border border-line px-3 py-2.5 text-sm outline-none focus:border-correction" />
        <div class="mt-3 flex gap-2">
          <button :disabled="busy || changeComment.trim().length < 5"
            class="cursor-pointer bg-correction px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            @click="requestChanges()">
            Send back
          </button>
          <button class="cursor-pointer border border-line px-4 py-2 text-sm" @click="showRequestChanges = false">Cancel</button>
        </div>
      </div>

      <p v-if="actionError" role="alert" class="mt-4 border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
        {{ actionError }}
      </p>

      <!-- Review comment history -->
      <section v-if="detail.comments.length" class="mt-8">
        <h2 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Review history</h2>
        <ol class="space-y-2.5">
          <li v-for="comment in detail.comments" :key="comment.id" class="border border-line bg-white px-4 py-3">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span class="font-medium">{{ comment.managerName }}</span>
              <span :class="comment.action === 'APPROVE' ? 'text-approved' : 'text-correction'" class="font-mono text-[11px] tracking-wider uppercase">
                {{ comment.action === 'APPROVE' ? 'approved' : 'requested changes' }}
              </span>
              <span class="text-draft">version {{ comment.versionNo }}</span>
              <span class="text-draft">{{ formatDateTime(comment.createdAt) }}</span>
            </div>
            <p v-if="comment.comment" class="mt-1.5 text-sm">“{{ comment.comment }}”</p>
          </li>
        </ol>
      </section>

      <!-- Version switcher -->
      <section v-if="detail.versions.length > 1" class="mt-8">
        <h2 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Versions</h2>
        <div class="flex flex-wrap gap-2">
          <button v-for="version in detail.versions" :key="version.id"
            class="cursor-pointer border px-3 py-1.5 font-mono text-xs"
            :class="selectedVersionId === version.id || (selectedVersionId === 'current' && detail.content?.versionId === version.id)
              ? 'border-ink-900 bg-ink-900 text-white'
              : 'border-line bg-white text-ink-500 hover:border-ink-500'"
            @click="viewVersion(version.id)">
            v{{ version.versionNo }} · {{ version.submittedAt ? `submitted ${formatDateTime(version.submittedAt)}` : 'draft in progress' }}
          </button>
        </div>
      </section>

      <!-- Content -->
      <section class="mt-8 border border-line bg-paper p-6">
        <p v-if="shownContent" class="mb-6 font-mono text-[11px] tracking-widest text-ink-500 uppercase">
          {{ selectedVersionId === 'current' ? `Version ${detail.content?.versionNo}` : `Version ${detail.versions.find((v) => v.id === selectedVersionId)?.versionNo}` }}
          <span v-if="detail.content?.isDraftContent && isOwner" class="text-correction">· draft in progress (not yet visible to managers)</span>
        </p>
        <ReportContent v-if="shownContent" :content="shownContent" />
        <p v-else class="text-ink-500">No content yet.</p>
      </section>
    </template>
  </div>
</template>
