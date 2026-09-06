import { z } from 'zod'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  HOUR_TYPES,
} from '../types/report'

const taskItemSchema = z.object({
  name: z.string().min(1, 'Task name is required').max(200),
  priority: z.enum(TASK_PRIORITIES),
  plannedPct: z.number().min(0).max(100),
  actualPct: z.number().min(0).max(100).nullable(),
  status: z.enum(TASK_STATUSES),
  timePlannedH: z.number().min(0).max(80).nullable(),
  timeSpentH: z.number().min(0).max(80).nullable(),
  deliverable: z.string().max(500),
})

const hourTypeSchema = z.partialRecord(z.enum(HOUR_TYPES), z.number().min(0).max(80))

export const reportContentSchema = z.object({
  tasks: z.array(taskItemSchema).max(30),
  nextWeekTasks: z.array(z.string().min(1).max(300)).max(20),
  blockers: z.array(z.object({
    text: z.string().min(1).max(500),
    isKey: z.boolean(),
  })).max(10),
  achievements: z.array(z.object({
    text: z.string().min(1).max(500),
    isKey: z.boolean(),
  })).max(10),
  hoursByType: hourTypeSchema,
  notes: z.string().max(2000).nullable(),
})

// weekStart/weekEnd are ISO date strings 'YYYY-MM-DD'
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use format YYYY-MM-DD')

export const createReportSchema = z.object({
  projectId: z.number().int().positive().nullable(),
  assignedManagerId: z.number().int().positive(),
  weekStart: isoDate,
  weekEnd: isoDate,
  content: reportContentSchema,
}).refine((v) => v.weekEnd >= v.weekStart, {
  message: 'Week end must be on or after week start',
  path: ['weekEnd'],
})

export const updateReportContentSchema = z.object({
  projectId: z.number().int().positive().nullable(),
  assignedManagerId: z.number().int().positive(),
  content: reportContentSchema,
})

export const approveReportSchema = z.object({
  comment: z.string().max(1000).optional(),
})

export const requestChangesSchema = z.object({
  comment: z.string().min(5, 'Describe what needs to change').max(1000),
})

export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED']).optional(),
  projectId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  // Free-text search: member name, project name, week or submitted date fragments.
  q: z.string().trim().min(1).max(80).optional(),
})

export type CreateReportInput = z.output<typeof createReportSchema>
export type UpdateReportContentInput = z.output<typeof updateReportContentSchema>
