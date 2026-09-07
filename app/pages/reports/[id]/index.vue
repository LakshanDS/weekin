<script setup lang="ts">
import { isoWeekOf } from '#shared/utils/week'
import type { ReportContent as ReportContentType, ReportStatus } from '#shared/types/report'

const route = useRoute()
const router = useRouter()
const reportId = Number(route.params.id)
const { user } = useAuth()
const isManager = computed(() => user.value?.role === 'MANAGER')
const isOwner = computed(() => detail.value?.report.userId === user.value?.id)
const isAssignedManager = computed(
  () => detail.value?.report.assignedManagerId != null && detail.value.report.assignedManagerId === user.value?.id,
)

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
    assignedManagerId: number | null
    assignedManagerName: string | null
    weekStart: string
    weekEnd: string
    status: ReportStatus
    submittedAt: string | null
  }
  content: (ReportContentType & { versionId: number; versionNo: number; isDraftContent: boolean }) | null
  comments: CommentRow[]
  versions: { id: number; versionNo: number; submittedAt: string | null; createdAt: string }[]
}

interface VersionFull extends ReportContentType {
  id: number
  versionNo: number
  submittedAt: string | null
}

const detail = ref<Detail | null>(null)
useHead({ title: () => (detail.value?.report.userName ? `${detail.value.report.userName}'s report` : 'Report') })
// Full content of every version the viewer may see, ascending.
const versions = ref<VersionFull[]>([])
const error = ref('')

// Back returns to wherever the user came from; dashboard visits continue to the queue, direct loads fall back to the list.
const backTo = ref('/reports')
onMounted(() => {
  const back = router.options.history.state.back
  if (typeof back === 'string' && back.startsWith('/')) {
    backTo.value = back.startsWith('/dashboard') ? '/review' : back
  }
})
const backLabel = computed(() =>
  backTo.value.startsWith('/review') ? 'Back to queue' : 'Back to reports',
)

// Forward the browser's cookies so $fetch works during SSR too.
const requestHeaders = useRequestHeaders(['cookie'])

async function load() {
  try {
    const [d, v] = await Promise.all([
      $fetch<Detail>(`/api/reports/${reportId}`, { headers: requestHeaders }),
      $fetch<{ versions: VersionFull[] }>(`/api/reports/${reportId}/versions`, { headers: requestHeaders }),
    ])
    detail.value = d
    versions.value = v.versions
  } catch (err) {
    const e = err as { statusCode?: number; data?: { statusMessage?: string } }
    error.value = e.statusCode === 404
      ? 'Report not found.'
      : e.data?.statusMessage ?? 'Something went wrong — try again.'
  }
}
await load()

// PR-style timeline: each version, then the review comments made on it.
type TimelineEvent =
  | { kind: 'version'; version: VersionFull }
  | { kind: 'comment'; comment: CommentRow }

const events = computed<TimelineEvent[]>(() => {
  const out: TimelineEvent[] = []
  for (const version of versions.value) {
    out.push({ kind: 'version', version })
    for (const comment of detail.value?.comments.filter((c) => c.versionNo === version.versionNo) ?? []) {
      out.push({ kind: 'comment', comment })
    }
  }
  return out
})

// --- actions ---
const busy = ref(false)
const actionError = ref('')
const reviewComment = ref('')

async function run(action: () => Promise<unknown>) {
  busy.value = true
  actionError.value = ''
  try {
    await action()
    reviewComment.value = ''
    await load()
  } catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    actionError.value = e.data?.statusMessage ?? 'Action failed. Try again.'
  } finally {
    busy.value = false
  }
}

// Approval allows an optional comment; requesting changes requires one (min 5 chars).
const approve = () => run(() => $fetch(`/api/reports/${reportId}/approve`, { method: 'POST', body: { comment: reviewComment.value.trim() } }))
const requestChanges = () =>
  run(() => $fetch(`/api/reports/${reportId}/request-changes`, { method: 'POST', body: { comment: reviewComment.value.trim() } }))

// Review outcome for a version: drives the timeline card tint.
const latestSubmittedVersionNo = computed(() =>
  versions.value.filter((v) => v.submittedAt).at(-1)?.versionNo,
)

function versionOutcome(versionNo: number): 'approved' | 'rejected' | 'open' {
  const comments = detail.value?.comments.filter((c) => c.versionNo === versionNo) ?? []
  if (comments.some((c) => c.action === 'APPROVE')) return 'approved'
  if (comments.some((c) => c.action === 'REQUEST_CHANGES')) return 'rejected'
  // A silent approval leaves no comment row; still tint the version that was approved.
  if (detail.value?.report.status === 'APPROVED' && versionNo === latestSubmittedVersionNo.value) return 'approved'
  return 'open'
}

const VERSION_TINT: Record<'approved' | 'rejected' | 'open', string> = {
  approved: 'border-approved/20 bg-approved/5',
  rejected: 'border-correction/20 bg-coral-tint/50',
  open: 'border-ink-subtle bg-white',
}

const latestCorrection = computed(() =>
  detail.value?.comments.filter((c) => c.action === 'REQUEST_CHANGES').at(-1),
)

const INPUT = 'block w-full rounded-md border border-ink-subtle bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-muted hover:border-[#d0d0d0] focus:border-ink focus:ring-[3px] focus:ring-coral-tint'
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <p v-if="error" class="rise mt-8 font-mono text-sm text-correction">{{ error }}</p>

    <template v-else-if="detail">
      <!-- Briefing band -->
      <section class="pt-4">
        <div class="flex flex-wrap items-start justify-between gap-6 max-sm:flex-nowrap max-sm:gap-x-4">
          <div class="min-w-0 flex-1">
            <NuxtLink
              :to="backTo"
              class="rise inline-block font-mono text-[10.5px] font-bold tracking-[0.15em] uppercase text-coral-dark transition-colors hover:text-coral"
              style="animation-delay: 0.05s"
            >
              ← {{ backLabel }}
            </NuxtLink>
            <h1
              class="rise mt-1 text-[18px] leading-[1.08] font-bold tracking-[-0.025em] sm:text-[clamp(24px,2.6vw,30px)]"
              style="animation-delay: 0.12s"
            >
              Week {{ isoWeekOf(detail.report.weekStart) }}<span class="text-coral">.</span>
            </h1>
            <p class="rise mt-1.5 truncate text-[14px] text-ink sm:text-[16px]" style="animation-delay: 0.22s">
              <b class="font-semibold">{{ detail.report.userName }}</b>
              <span class="text-ink-muted"> · </span>
              {{ detail.report.projectName ?? 'No project' }}
            </p>
          </div>

          <div class="rise flex shrink-0 flex-col items-end gap-1 text-right" style="animation-delay: 0.1s">
            <StatusTag :status="detail.report.status" />
            <p class="mt-1 font-mono text-[13px] font-semibold tracking-[0.15em] uppercase text-ink">
              {{ formatWeekRange(detail.report.weekStart, detail.report.weekEnd) }}
            </p>
            <p class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-muted">
              {{ detail.report.submittedAt ? `submitted ${formatDateTime(detail.report.submittedAt)}` : 'not submitted yet' }}
            </p>
            <p
              v-if="detail.report.assignedManagerName"
              class="font-mono text-[10.5px] tracking-[0.12em] uppercase"
              :class="isAssignedManager ? 'font-semibold text-coral-dark' : 'text-ink-muted'"
            >
              assigned to {{ isAssignedManager ? 'you' : detail.report.assignedManagerName }}
            </p>
          </div>
        </div>
      </section>

      <!-- Correction banner for the owner -->
      <div
        v-if="isOwner && detail.report.status === 'NEEDS_CORRECTION' && latestCorrection"
        class="rise mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-correction/30 bg-coral-tint px-4 py-3.5"
        style="animation-delay: 0.28s"
      >
        <div class="min-w-0">
          <p class="font-mono text-[10.5px] font-semibold tracking-[0.15em] uppercase text-coral-dark">
            Sent back — fix and resubmit
          </p>
          <p class="mt-1.5 text-sm text-ink">“{{ latestCorrection.comment }}” — {{ latestCorrection.managerName }}</p>
        </div>
        <NuxtLink
          :to="`/reports/${reportId}/edit`"
          class="shrink-0 cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a]"
        >
          Update report
        </NuxtLink>
      </div>

      <!-- Draft banner for the owner: drafts stay editable until submitted -->
      <div
        v-if="isOwner && detail.report.status === 'DRAFT'"
        class="rise mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-ink-subtle bg-ink-tint px-4 py-3.5"
        style="animation-delay: 0.28s"
      >
        <div class="min-w-0">
          <p class="font-mono text-[10.5px] font-semibold tracking-[0.15em] uppercase text-ink-soft">
            Draft — not submitted yet
          </p>
          <p class="mt-1.5 text-sm text-ink">Managers can't see this report until you submit it for review.</p>
        </div>
        <NuxtLink
          :to="`/reports/${reportId}/edit`"
          class="shrink-0 cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a]"
        >
          Update report
        </NuxtLink>
      </div>

      <!-- Draft-in-progress note for the owner -->
      <p
        v-if="isOwner && detail.content?.isDraftContent && detail.report.status === 'NEEDS_CORRECTION'"
        class="rise mt-4 font-mono text-[10.5px] tracking-[0.06em] text-ink-muted"
        style="animation-delay: 0.3s"
      >
        You have unsaved-to-review edits in progress (version {{ detail.content.versionNo }}). Resubmit from the editor when ready.
      </p>

      <!-- Timeline: version → its review comments → next version → … → review box -->
      <p v-if="!events.length" class="rise mt-8 text-sm text-ink-muted">No content yet.</p>

      <ol v-else class="rise relative mt-8 before:absolute before:bottom-4 before:left-2 before:top-3 before:w-px before:bg-ink-subtle">
        <li
          v-for="event in events"
          :key="event.kind === 'version' ? `v${event.version.id}` : `c${event.comment.id}`"
          class="relative pb-8 pl-10 last:pb-4"
        >
          <!-- Version snapshot -->
          <template v-if="event.kind === 'version'">
            <span class="absolute left-0 top-0 size-4 rounded-full border-[3px] border-ink bg-white" aria-hidden="true" />
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p class="font-mono text-[10.5px] font-semibold tracking-[0.15em] uppercase text-ink-muted">
                Version {{ event.version.versionNo }}
                · {{ event.version.submittedAt ? `submitted ${formatDateTime(event.version.submittedAt)}` : 'draft in progress' }}
              </p>
              <p
                v-if="!event.version.submittedAt && isOwner"
                class="font-mono text-[10.5px] tracking-[0.12em] uppercase text-coral-dark"
              >
                Not yet visible to managers
              </p>
            </div>
            <div class="mt-3 rounded-[6px] border p-6" :class="VERSION_TINT[versionOutcome(event.version.versionNo)]">
              <ReportContent :content="event.version" />
            </div>
          </template>

            <!-- Review comment on the version above -->
            <template v-else>
              <span
                class="absolute -left-2 top-0 flex size-8 items-center justify-center rounded-full bg-ink-tint font-mono text-[9.5px] text-ink-soft"
                aria-hidden="true"
              >
                {{ initials(event.comment.managerName) }}
              </span>
              <div
                class="rounded-[6px] border px-4 py-3"
                :class="event.comment.action === 'APPROVE' ? 'border-approved/25 bg-approved/10' : 'border-correction/25 bg-coral-tint'"
              >
              <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <b class="text-sm font-semibold">{{ event.comment.managerName }}</b>
                <span
                  class="font-mono text-[10px] tracking-[0.12em] uppercase"
                  :class="event.comment.action === 'APPROVE' ? 'text-approved' : 'text-coral-dark'"
                >
                  {{ event.comment.action === 'APPROVE' ? 'approved' : 'requested changes' }}
                </span>
                <span class="font-mono text-[10.5px] tracking-[0.06em] text-ink-muted">
                  {{ formatDateTime(event.comment.createdAt) }}
                </span>
              </div>
              <p v-if="event.comment.comment" class="mt-1.5 text-sm text-ink-soft">“{{ event.comment.comment }}”</p>
              <p v-else-if="event.comment.action === 'APPROVE'" class="mt-1.5 text-sm text-ink-soft italic">Approved.</p>
            </div>
          </template>
        </li>

        <!-- Review box closes the timeline -->
        <li v-if="isManager && detail.report.status === 'SUBMITTED'" class="relative pl-10">
          <span class="absolute left-0 top-0 size-4 rounded-full border-[3px] border-coral bg-white" aria-hidden="true" />
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-mono text-[10.5px] font-semibold tracking-[0.15em] uppercase text-ink-muted">Your review</p>
            <span
              v-if="isAssignedManager"
              class="rounded-[2px] bg-coral-tint px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.12em] uppercase text-coral-dark"
            >
              assigned to you
            </span>
          </div>
          <div class="mt-3 rounded-[6px] border border-ink-subtle bg-white p-4">
            <label for="review-comment" class="mb-2 block text-sm text-ink-soft">
              Comment for {{ detail.report.userName }} <span class="text-ink-muted">(required to request changes)</span>
            </label>
            <textarea
              id="review-comment"
              v-model="reviewComment"
              rows="3"
              placeholder="e.g. Blockers section is empty but two tasks are still at 40%…"
              :class="INPUT"
            />
            <p v-if="actionError" role="alert" class="mt-3 rounded-[6px] border border-correction/40 bg-correction/10 px-3.5 py-2.5 text-sm text-correction">
              {{ actionError }}
            </p>
            <div class="mt-3 flex flex-wrap items-center justify-end gap-3">
              <button
                :disabled="busy"
                class="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a3a3a] disabled:opacity-60"
                @click="approve()"
              >
                Approve
              </button>
              <button
                :disabled="busy || reviewComment.trim().length < 5"
                class="cursor-pointer rounded-[10px] border border-correction/30 bg-coral-tint px-4 py-2 text-sm font-semibold text-coral-dark transition-colors hover:bg-coral/15 disabled:cursor-not-allowed disabled:opacity-50"
                @click="requestChanges()"
              >
                Request changes
              </button>
            </div>
          </div>
        </li>
      </ol>
    </template>
  </div>
</template>
