import { describe, expect, it } from 'vitest'
import type { TaskItem } from '../shared/types/report'
import {
  aggregateMemberPerformance,
  aggregateProjectHours,
  expectedWeeksOf,
  findReportDetail,
  type ReportRow,
  type RosterEntry,
} from '../server/utils/ai-tools'

// Fixtures mimic the fetch shape: rows sorted weekStart desc (as the SQL does).
const WINDOW_START = '2026-07-27' // 3-week window ending Monday 2026-08-10

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    name: 'task',
    priority: 'MEDIUM',
    plannedPct: 50,
    actualPct: null,
    status: 'TODO',
    timePlannedH: null,
    timeSpentH: null,
    deliverable: '',
    ...overrides,
  }
}

function row(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    userName: 'Alice',
    status: 'APPROVED',
    projectName: 'Apollo',
    weekStart: '2026-08-10',
    tasks: [],
    nextWeekTasks: [],
    blockers: [],
    achievements: [],
    hoursByType: {},
    notes: null,
    ...overrides,
  }
}

const roster: RosterEntry[] = [
  { name: 'Alice', memberSince: '2025-01-06' },
  { name: 'Bob', memberSince: '2026-08-10' },
]

describe('expectedWeeksOf', () => {
  it('counts the full window for an existing member', () => {
    expect(expectedWeeksOf('2025-01-06', WINDOW_START, 3)).toBe(3)
  })

  it('reduces the expectation for someone who joined mid-window', () => {
    // Bob joined on the last Monday of the window.
    expect(expectedWeeksOf('2026-08-10', WINDOW_START, 3)).toBe(1)
    expect(expectedWeeksOf('2026-08-03', WINDOW_START, 3)).toBe(2)
  })

  it('never goes below zero for a future join date', () => {
    expect(expectedWeeksOf('2026-09-01', WINDOW_START, 3)).toBe(0)
  })
})

describe('aggregateProjectHours', () => {
  const rows: ReportRow[] = [
    row({
      userName: 'Alice',
      projectName: 'Apollo',
      weekStart: '2026-08-10',
      hoursByType: { development: 20.5, meetings: 2 },
      tasks: [task({ timePlannedH: 10, timeSpentH: 12 }), task({ timePlannedH: 5, timeSpentH: null })],
    }),
    row({
      userName: 'Bob',
      projectName: 'Apollo',
      weekStart: '2026-08-03',
      hoursByType: { testing: 4 },
      tasks: [task({ timePlannedH: 8, timeSpentH: 6 })],
    }),
    row({ userName: 'Alice', projectName: null, weekStart: '2026-08-03', hoursByType: { documentation: 3 } }),
  ]

  it('sums hoursByType per project, case-insensitively', () => {
    const result = aggregateProjectHours(rows, 'APOLLO', WINDOW_START, 3)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].totalHours).toBe(26.5)
    expect(result.projects[0].byType).toEqual({ development: 20.5, meetings: 2, testing: 4 })
  })

  it('breaks hours down per member and groups unassigned work under "No project"', () => {
    const result = aggregateProjectHours(rows, undefined, WINDOW_START, 3)
    const apollo = result.projects.find((p) => p.project === 'Apollo')
    expect(apollo?.byMember).toEqual({ Alice: 22.5, Bob: 4 })
    expect(result.projects.find((p) => p.project === 'No project')?.totalHours).toBe(3)
  })

  it('keeps task-level planned vs spent hours separate from hoursByType totals', () => {
    const result = aggregateProjectHours(rows, undefined, WINDOW_START, 3)
    expect(result.taskTime).toEqual({ plannedH: 23, spentH: 18 })
  })

  it('returns an empty project list for an unknown project name', () => {
    const result = aggregateProjectHours(rows, 'Zenith', WINDOW_START, 3)
    expect(result.projects).toEqual([])
    expect(result.taskTime).toEqual({ plannedH: 0, spentH: 0 })
  })
})

describe('aggregateMemberPerformance', () => {
  const rows: ReportRow[] = [
    row({
      userName: 'Alice',
      weekStart: '2026-08-10',
      hoursByType: { development: 10 },
      tasks: [task({ status: 'DONE', plannedPct: 40, actualPct: 45 }), task({ status: 'BLOCKED' })],
      blockers: [{ text: 'waiting on API access', isKey: true }],
    }),
    row({
      userName: 'Alice',
      weekStart: '2026-08-03',
      hoursByType: { meetings: 1.5 },
      tasks: [task({ status: 'DONE', plannedPct: 60 })],
    }),
  ]

  it('aggregates completion, blocked, hours, and key blockers per member', () => {
    const result = aggregateMemberPerformance(rows, roster, undefined, WINDOW_START, 3)
    const alice = result.find((m) => m.member === 'Alice')
    expect(alice).toMatchObject({
      member: 'Alice',
      weeksSubmitted: 2,
      weeksExpected: 3,
      tasksDone: 2,
      tasksTotal: 3,
      tasksBlocked: 1,
      avgPlannedPct: 50,
      avgActualPct: 45,
      hoursTotal: 11.5,
      keyBlockers: 1,
    })
  })

  it('includes roster members with zero submissions instead of hiding them', () => {
    const result = aggregateMemberPerformance(rows, roster, undefined, WINDOW_START, 3)
    const bob = result.find((m) => m.member === 'Bob')
    expect(bob).toMatchObject({
      member: 'Bob',
      weeksSubmitted: 0,
      weeksExpected: 1,
      tasksTotal: 0,
      avgPlannedPct: null,
      avgActualPct: null,
      hoursTotal: 0,
      note: 'no submitted reports in window',
    })
  })

  it('filters by member name case-insensitively', () => {
    const result = aggregateMemberPerformance(rows, roster, 'alice', WINDOW_START, 3)
    expect(result.map((m) => m.member)).toEqual(['Alice'])
  })

  it('returns nothing for a member missing from the roster', () => {
    const result = aggregateMemberPerformance(rows, roster, 'Zed', WINDOW_START, 3)
    expect(result).toEqual([])
  })
})

describe('findReportDetail', () => {
  const rows: ReportRow[] = [
    row({ userName: 'Alice', weekStart: '2026-08-10', notes: 'latest' }),
    row({ userName: 'Alice', weekStart: '2026-08-03', notes: 'older' }),
  ]

  it('defaults to the most recent submitted report', () => {
    expect(findReportDetail(rows, 'alice', undefined)?.notes).toBe('latest')
  })

  it('finds a specific week by its Monday', () => {
    expect(findReportDetail(rows, 'Alice', '2026-08-03')?.notes).toBe('older')
  })

  it('returns null for unknown members or weeks', () => {
    expect(findReportDetail(rows, 'Zed', undefined)).toBeNull()
    expect(findReportDetail(rows, 'Alice', '2026-07-27')).toBeNull()
  })
})
