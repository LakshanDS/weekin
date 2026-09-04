import { z } from 'zod'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  HOUR_TYPES,
} from '../types/report'

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  email: z.email('Enter a valid email address').max(255),
  // Signup always creates a MEMBER account; MANAGER is granted by an admin.
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
})

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

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

// weekStart/weekEnd validated as ISO date strings 'YYYY-MM-DD'
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use format YYYY-MM-DD')

export const createReportSchema = z.object({
  projectId: z.number().int().positive().nullable(),
  weekStart: isoDate,
  weekEnd: isoDate,
  content: reportContentSchema,
}).refine((v) => v.weekEnd >= v.weekStart, {
  message: 'Week end must be on or after week start',
  path: ['weekEnd'],
})

export const updateReportContentSchema = z.object({
  projectId: z.number().int().positive().nullable(),
  content: reportContentSchema,
})

export type RegisterInput = z.output<typeof registerSchema>
export type LoginInput = z.output<typeof loginSchema>
export type CreateReportInput = z.output<typeof createReportSchema>
export type UpdateReportContentInput = z.output<typeof updateReportContentSchema>
