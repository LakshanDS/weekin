// Report content structure — identical for every user, versioned as a snapshot.
// Shared between the DB schema (jsonb columns), zod validation, and Vue forms.

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const HOUR_TYPES = ['development', 'testing', 'meetings', 'documentation'] as const
export type HourType = (typeof HOUR_TYPES)[number]

export interface TaskItem {
  name: string
  priority: TaskPriority
  plannedPct: number
  actualPct: number | null
  status: TaskStatus
  timePlannedH: number | null
  timeSpentH: number | null
  deliverable: string
}

export interface BlockerItem {
  text: string
  isKey: boolean
}

export interface AchievementItem {
  text: string
  isKey: boolean
}

export type HoursByType = Partial<Record<HourType, number>>

// One snapshot of a report's content (report_versions row)
export interface ReportContent {
  tasks: TaskItem[]
  nextWeekTasks: string[]
  blockers: BlockerItem[]
  achievements: AchievementItem[]
  hoursByType: HoursByType
  notes: string | null
}

export const REPORT_STATUSES = ['DRAFT', 'SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]
