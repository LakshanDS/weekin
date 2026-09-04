<script setup lang="ts">
// Split auth layout: ink panel with the product's own vocabulary on the left,
// the form on paper on the right. Two panel variants:
//   'pipeline'  — the review loop (login)
//   'structure' — the fixed report shape (register)
defineProps<{ variant: 'pipeline' | 'structure' }>()

const DAYS = ['M', 'T', 'W', 'T', 'F']
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-[5fr_6fr]">
    <!-- Ink panel -->
    <aside class="relative flex flex-col justify-between overflow-hidden bg-ink-900 px-8 py-8 text-white lg:px-12 lg:py-12">
      <!-- Brand -->
      <div class="flex items-center gap-3">
        <WeekLogMark />
        <span class="font-display text-xl font-bold tracking-tight">WeekLog</span>
      </div>

      <!-- Compact mobile caption (full panel shows from lg up) -->
      <p class="mt-10 max-w-xs font-mono text-xs leading-relaxed text-slate-400 lg:hidden">
        Weekly reports for the team. Members log the week; managers review and approve.
      </p>

      <!-- Signature panel -->
      <div class="hidden flex-1 flex-col justify-center lg:flex">
        <template v-if="variant === 'pipeline'">
          <p class="rise font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">The weekly loop</p>

          <div class="mt-6 space-y-3">
            <div class="rise flex items-center justify-between border border-white/10 bg-ink-700/60 px-4 py-3" style="animation-delay: 0.1s">
              <div>
                <p class="font-mono text-[11px] text-slate-400">WEEK 32</p>
                <p class="text-sm text-slate-300">Tasks, blockers, hours</p>
              </div>
              <StatusTag status="DRAFT" tone="dark" />
            </div>

            <div class="rise flex items-center justify-between border border-white/10 bg-ink-700/60 px-4 py-3" style="animation-delay: 0.35s">
              <div>
                <p class="font-mono text-[11px] text-slate-400">WEEK 33</p>
                <p class="text-sm text-slate-300">Sent back once, fixed, resubmitted</p>
              </div>
              <StatusTag status="NEEDS_CORRECTION" tone="dark" />
            </div>

            <div class="rise relative flex items-center justify-between border border-approved/40 bg-approved/10 px-4 py-3" style="animation-delay: 0.6s">
              <div>
                <p class="font-mono text-[11px] text-[#8fd8b8]">WEEK 34</p>
                <p class="text-sm text-white">Read, approved, archived</p>
              </div>
              <div class="stamp">
                <StatusTag status="APPROVED" tone="dark" />
              </div>
            </div>
          </div>

          <p class="rise mt-6 max-w-sm text-[15px] leading-relaxed text-slate-300" style="animation-delay: 0.8s">
            One report a week. Your manager reads every one — and sends it back
            with a comment when something doesn't add up.
          </p>
        </template>

        <template v-else>
          <p class="rise font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase">Every report, same shape</p>

          <ul class="rise mt-6 grid max-w-sm grid-cols-2 gap-2.5" style="animation-delay: 0.2s">
            <li v-for="section in ['Task table', 'Next week', 'Blockers', 'Highlights', 'Hours by type', 'Notes & links']"
              :key="section"
              class="border border-white/10 bg-ink-700/60 px-3.5 py-2.5 font-mono text-xs text-slate-300"
            >
              {{ section }}
            </li>
          </ul>

          <p class="rise mt-6 max-w-sm text-[15px] leading-relaxed text-slate-300" style="animation-delay: 0.5s">
            The whole team reports in the same structure — that's what makes the
            manager's dashboard honest. Join as a team member; a manager can
            promote your account later.
          </p>
        </template>
      </div>

      <!-- Review-day marker -->
      <div class="mt-10 hidden items-center gap-4 lg:flex" aria-hidden="true">
        <div class="flex gap-1.5">
          <span
            v-for="(day, i) in DAYS"
            :key="i"
            class="flex size-8 items-center justify-center border font-mono text-xs"
            :class="i === DAYS.length - 1
              ? 'border-approved/60 bg-approved/15 text-[#8fd8b8]'
              : 'border-white/10 text-slate-500'"
          >{{ day }}</span>
        </div>
        <p class="font-mono text-[11px] text-slate-500">Friday 17:00 — the week goes to review</p>
      </div>
    </aside>

    <!-- Form side -->
    <main class="flex items-center justify-center px-5 py-10 sm:px-10">
      <div class="w-full max-w-md">
        <slot />
      </div>
    </main>
  </div>
</template>
