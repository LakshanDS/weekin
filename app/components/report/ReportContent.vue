<script setup lang="ts">
import type { ReportContent as ReportContentType, TaskItem } from '#shared/types/report'

// Read-only rendering of one report version's content.
defineProps<{ content: ReportContentType }>()

const PRIORITY_CLASS: Record<TaskItem['priority'], string> = {
  LOW: 'text-ink-500',
  MEDIUM: 'text-body',
  HIGH: 'text-correction font-medium',
}

const dt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const fmt = (iso: string) => dt.format(new Date(`${iso}T00:00:00Z`))
</script>

<template>
  <div class="space-y-8">
    <section>
      <h3 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Tasks completed</h3>
      <div class="overflow-x-auto border border-line bg-white">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-line text-left font-mono text-[11px] tracking-wider text-ink-500 uppercase">
              <th class="px-3 py-2 font-medium">Task</th>
              <th class="px-3 py-2 font-medium">Priority</th>
              <th class="px-3 py-2 font-medium">Planned</th>
              <th class="px-3 py-2 font-medium">Actual</th>
              <th class="px-3 py-2 font-medium">Status</th>
              <th class="px-3 py-2 font-medium">Time (pl/sp)</th>
              <th class="px-3 py-2 font-medium">Deliverable</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(task, i) in content.tasks" :key="i" class="border-b border-line/60 last:border-0">
              <td class="px-3 py-2 font-medium">{{ task.name }}</td>
              <td class="px-3 py-2" :class="PRIORITY_CLASS[task.priority]">{{ task.priority }}</td>
              <td class="px-3 py-2 tabular-nums">{{ task.plannedPct }}%</td>
              <td class="px-3 py-2 tabular-nums">{{ task.actualPct !== null ? `${task.actualPct}%` : '—' }}</td>
              <td class="px-3 py-2">{{ task.status.replace('_', ' ').toLowerCase() }}</td>
              <td class="px-3 py-2 tabular-nums">{{ task.timePlannedH ?? '—' }}h / {{ task.timeSpentH ?? '—' }}h</td>
              <td class="px-3 py-2 text-ink-500">{{ task.deliverable || '—' }}</td>
            </tr>
            <tr v-if="content.tasks.length === 0">
              <td colspan="7" class="px-3 py-4 text-ink-500">No tasks recorded.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="grid gap-8 md:grid-cols-2">
      <section>
        <h3 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Planned for next week</h3>
        <ul class="space-y-1.5 text-sm">
          <li v-for="(task, i) in content.nextWeekTasks" :key="i" class="flex gap-2">
            <span class="text-approved">→</span> {{ task }}
          </li>
          <li v-if="content.nextWeekTasks.length === 0" class="text-ink-500">Nothing planned yet.</li>
        </ul>
      </section>

      <section>
        <h3 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Hours by type</h3>
        <div class="flex flex-wrap gap-2">
          <span v-for="(hours, type) in content.hoursByType" :key="type"
            class="border border-line bg-white px-2.5 py-1 font-mono text-xs">
            {{ type }} · {{ hours }}h
          </span>
          <span v-if="!Object.keys(content.hoursByType).length" class="text-sm text-ink-500">Not tracked.</span>
        </div>
      </section>
    </div>

    <div class="grid gap-8 md:grid-cols-2">
      <section>
        <h3 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Blockers</h3>
        <ul class="space-y-2 text-sm">
          <li v-for="(blocker, i) in content.blockers" :key="i"
            class="border px-3 py-2"
            :class="blocker.isKey ? 'border-correction/40 bg-correction/10' : 'border-line bg-white'">
            <span v-if="blocker.isKey" class="mr-2 font-mono text-[10px] tracking-wider text-correction uppercase">Key issue</span>
            {{ blocker.text }}
          </li>
          <li v-if="content.blockers.length === 0" class="text-ink-500">No blockers.</li>
        </ul>
      </section>

      <section>
        <h3 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Achievements</h3>
        <ul class="space-y-2 text-sm">
          <li v-for="(item, i) in content.achievements" :key="i"
            class="border px-3 py-2"
            :class="item.isKey ? 'border-approved/40 bg-approved/10' : 'border-line bg-white'">
            <span v-if="item.isKey" class="mr-2 font-mono text-[10px] tracking-wider text-approved uppercase">Key win</span>
            {{ item.text }}
          </li>
          <li v-if="content.achievements.length === 0" class="text-ink-500">None recorded.</li>
        </ul>
      </section>
    </div>

    <section v-if="content.notes">
      <h3 class="mb-3 font-mono text-[11px] tracking-widest text-ink-500 uppercase">Notes & links</h3>
      <p class="border border-line bg-white px-3 py-2 text-sm whitespace-pre-line">{{ content.notes }}</p>
    </section>
  </div>
</template>
