import type { TaskItem, BlockerItem, AchievementItem, HoursByType } from '../../shared/types/report'
import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  jsonb,
  date,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['MEMBER', 'MANAGER'])
// Self-registered accounts wait in PENDING until a manager approves them
export const userStatusEnum = pgEnum('user_status', ['PENDING', 'ACTIVE'])
export const reportStatusEnum = pgEnum('report_status', [
  'DRAFT',
  'SUBMITTED',
  'NEEDS_CORRECTION',
  'APPROVED',
])
export const reviewActionEnum = pgEnum('review_action', ['REQUEST_CHANGES', 'APPROVE'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('MEMBER'),
  status: userStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
    assignedManagerId: integer('assigned_manager_id').references(() => users.id, {onDelete: 'set null'}),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    weekEnd: date('week_end', { mode: 'string' }).notNull(),
    status: reportStatusEnum('status').notNull().default('DRAFT'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('reports_user_week_uq').on(t.userId, t.weekStart),
    index('reports_project_id_idx').on(t.projectId),
  ],
)

// One row per content snapshot. Draft edits update the latest unsubmitted row
// in place; every submit freezes it, so correction cycles build up history.
export const reportVersions = pgTable(
  'report_versions',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    versionNo: integer('version_no').notNull(),
    tasks: jsonb('tasks').$type<TaskItem[]>().notNull().default([]),
    nextWeekTasks: jsonb('next_week_tasks').$type<string[]>().notNull().default([]),
    blockers: jsonb('blockers').$type<BlockerItem[]>().notNull().default([]),
    achievements: jsonb('achievements').$type<AchievementItem[]>().notNull().default([]),
    hoursByType: jsonb('hours_by_type').$type<HoursByType>().notNull().default({}),
    notes: text('notes'),
    // null = draft-in-progress (never submitted, invisible to managers)
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('report_versions_report_no_uq').on(t.reportId, t.versionNo)],
)

// Comments are tied to the exact version they were written against.
export const reviewComments = pgTable(
  'review_comments',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    versionId: integer('version_id')
      .notNull()
      .references(() => reportVersions.id, { onDelete: 'cascade' }),
    managerId: integer('manager_id')
      .notNull()
      .references(() => users.id),
    action: reviewActionEnum('action').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('review_comments_report_id_idx').on(t.reportId)],
)
