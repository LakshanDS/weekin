<script setup lang="ts">
import type { ReportContent as ReportContentType, TaskItem } from '#shared/types/report'

// Read-only rendering of one report version's content.
defineProps<{ content: ReportContentType }>()

const PRIORITY_CLASS: Record<TaskItem['priority'], string> = {
  LOW: 'text-ink-muted',
  MEDIUM: 'text-ink-soft',
  HIGH: 'text-coral-dark font-medium',
}

const EYEBROW = 'mb-3 block font-mono text-[10.5px] font-semibold tracking-[0.15em] uppercase text-ink-muted'
</script>

<template>
  <div class="space-y-8">
    <section>
      <h3 :class="EYEBROW">Tasks completed</h3>
      <div class="overflow-x-auto rounded-[6px] border border-ink-subtle bg-white">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-ink-subtle text-left font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
              <th class="px-3 py-2.5 font-medium">Task</th>
              <th class="px-3 py-2.5 font-medium">Priority</th>
              <th class="px-3 py-2.5 font-medium">Planned</th>
              <th class="px-3 py-2.5 font-medium">Actual</th>
              <th class="px-3 py-2.5 font-medium">Status</th>
              <th class="px-3 py-2.5 font-medium">Time (pl/sp)</th>
              <th class="px-3 py-2.5 font-medium">Deliverable</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(task, i) in content.tasks" :key="i" class="border-b border-ink-subtle/60 even:bg-ink-tint/60 last:border-0">
              <td class="px-3 py-2.5 font-medium">{{ task.name }}</td>
              <td class="px-3 py-2.5" :class="PRIORITY_CLASS[task.priority]">{{ task.priority }}</td>
              <td class="px-3 py-2.5 tabular-nums">{{ task.plannedPct }}%</td>
              <td class="px-3 py-2.5 tabular-nums">{{ task.actualPct !== null ? `${task.actualPct}%` : '—' }}</td>
              <td class="px-3 py-2.5 whitespace-nowrap text-ink-soft">{{ task.status.replace('_', ' ').toLowerCase() }}</td>
              <td class="px-3 py-2.5 tabular-nums">{{ task.timePlannedH ?? '—' }}h / {{ task.timeSpentH ?? '—' }}h</td>
              <td class="px-3 py-2.5 text-ink-soft">{{ task.deliverable || '—' }}</td>
            </tr>
            <tr v-if="content.tasks.length === 0">
              <td colspan="7" class="px-3 py-4 text-ink-muted">No tasks recorded.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h3 :class="EYEBROW">Hours by type</h3>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="(hours, type) in content.hoursByType" :key="type"
          class="flex items-center justify-between gap-2 rounded-[6px] border border-ink-subtle bg-white px-3 py-2">
          <span class="min-w-0 truncate font-mono text-[10px] tracking-[0.12em] uppercase text-ink-muted">{{ type }}</span>
          <span class="shrink-0 text-sm font-medium tabular-nums text-ink">{{ hours }}h</span>
        </div>
        <p v-if="!Object.keys(content.hoursByType).length" class="text-sm text-ink-muted">Not tracked.</p>
      </div>
    </section>

    <div class="grid gap-8 md:grid-cols-2">
      <section>
        <h3 :class="EYEBROW">Achievements</h3>
        <ul class="space-y-2 text-sm">
          <li v-for="(item, i) in content.achievements" :key="i"
            class="rounded-[6px] border px-3 py-2"
            :class="item.isKey ? 'border-approved/40 bg-approved/10' : 'border-ink-subtle bg-white'">
            <span v-if="item.isKey" class="mr-2 font-mono text-[9.5px] tracking-[0.12em] text-approved uppercase">Key win</span>
            {{ item.text }}
          </li>
          <li v-if="content.achievements.length === 0" class="text-ink-muted">None recorded.</li>
        </ul>
      </section>

      <section>
        <h3 :class="EYEBROW">Blockers</h3>
        <ul class="space-y-2 text-sm">
          <li v-for="(blocker, i) in content.blockers" :key="i"
            class="rounded-[6px] border px-3 py-2"
            :class="blocker.isKey ? 'border-correction/30 bg-coral-tint' : 'border-ink-subtle bg-white'">
            <span v-if="blocker.isKey" class="mr-2 font-mono text-[9.5px] tracking-[0.12em] text-coral-dark uppercase">Key issue</span>
            {{ blocker.text }}
          </li>
          <li v-if="content.blockers.length === 0" class="text-ink-muted">No blockers.</li>
        </ul>
      </section>
    </div>

    <section>
      <h3 :class="EYEBROW">Planned for next week</h3>
      <ul class="space-y-1.5 text-sm">
        <li v-for="(task, i) in content.nextWeekTasks" :key="i" class="flex gap-2">
          <span class="text-approved">→</span> {{ task }}
        </li>
        <li v-if="content.nextWeekTasks.length === 0" class="text-ink-muted">Nothing planned yet.</li>
      </ul>
    </section>

    <section v-if="content.notes">
      <h3 :class="EYEBROW">Notes & links</h3>
      <p class="rounded-[6px] border border-ink-subtle bg-white px-3 py-2 text-sm whitespace-pre-line">{{ content.notes }}</p>
    </section>
  </div>
</template>
