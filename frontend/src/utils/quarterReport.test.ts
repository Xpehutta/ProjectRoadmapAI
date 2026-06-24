import { describe, expect, it } from 'vitest'
import type { ProjectDetail, Task } from '../types'
import {
  buildQuarterReport,
  briefDate,
  briefDateRange,
  compactQuarterReport,
  dateInQuarter,
  desiredQuarterMatches,
  quarterRange,
  rangeOverlapsQuarter,
} from './quarterReport'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    project_id: 1,
    name: 'Витрина А',
    status: 'in_progress',
    version: 1,
    sub_stages: [],
    predecessors: [],
    internal_stage_links: [],
    component_usage_count: 0,
    ...overrides,
  } as Task
}

function project(tasks: Task[]): ProjectDetail {
  return {
    id: 1,
    name: 'P',
    description: null,
    table_schema: null,
    created_at: '2024-01-01',
    categories: [],
    components: [],
    releases: [],
    goals: [],
    tasks,
    milestones: [],
    dependencies: [],
  }
}

describe('quarterRange', () => {
  it('returns Q1 bounds', () => {
    const { start, end } = quarterRange(2024, 1)
    expect(start.getMonth()).toBe(0)
    expect(end.getMonth()).toBe(2)
    expect(end.getDate()).toBe(31)
  })
})

describe('dateInQuarter', () => {
  it('detects dates inside quarter', () => {
    expect(dateInQuarter('2024-02-15', 2024, 1)).toBe(true)
    expect(dateInQuarter('2024-04-01', 2024, 1)).toBe(false)
  })
})

describe('rangeOverlapsQuarter', () => {
  it('detects overlapping ranges', () => {
    expect(rangeOverlapsQuarter('2024-01-01', '2024-06-01', 2024, 1)).toBe(true)
    expect(rangeOverlapsQuarter('2024-05-01', '2024-06-01', 2024, 1)).toBe(false)
  })
})

describe('desiredQuarterMatches', () => {
  it('matches quarter text and year', () => {
    expect(desiredQuarterMatches('Q1 2024', 2024, 1)).toBe(true)
    expect(desiredQuarterMatches('Q1 2024', 2024, 2)).toBe(false)
    expect(desiredQuarterMatches('2024-02-10', 2024, 1)).toBe(true)
  })
})

describe('buildQuarterReport', () => {
  it('collects done stages and plan items', () => {
    const t = task({
      sub_stages: [
        {
          id: 10,
          task_id: 1,
          name: 'Разработка',
          sort_order: 0,
          is_done: true,
          start_date: '2024-01-10',
          end_date: '2024-03-20',
          due_date: '2024-03-20',
          note: null,
          is_indicative: true,
          predecessor_stage_ids: [],
        },
        {
          id: 11,
          task_id: 1,
          name: 'Тест',
          sort_order: 1,
          is_done: false,
          start_date: '2024-04-01',
          end_date: '2024-04-30',
          due_date: '2024-04-30',
          note: null,
          is_indicative: true,
          predecessor_stage_ids: [],
        },
      ],
      indicative_start: '2024-04-01',
      indicative_end: '2024-04-30',
    })
    const report = buildQuarterReport({
      project: project([t]),
      year: 2024,
      quarter: 1,
      auditEvents: [],
      savedTaskShifts: {},
      savedStageShifts: {},
      savedMilestoneShifts: {},
    })
    expect(report.done).toHaveLength(1)
    expect(report.done[0].label).toBe('Разработка')
    expect(report.plan).toHaveLength(0)
  })
})

describe('compactQuarterReport', () => {
  it('formats short one-line entries', () => {
    const report = buildQuarterReport({
      project: project([
        task({
          subproduct: 'Витрина X',
          sub_stages: [
            {
              id: 10,
              task_id: 1,
              name: 'Разработка',
              sort_order: 0,
              is_done: true,
              start_date: '2024-03-01',
              end_date: '2024-03-20',
              due_date: '2024-03-20',
              note: null,
              is_indicative: true,
              predecessor_stage_ids: [],
            },
          ],
        }),
      ]),
      year: 2024,
      quarter: 1,
      auditEvents: [],
      savedTaskShifts: {},
      savedStageShifts: {},
      savedMilestoneShifts: {},
    })
    const brief = compactQuarterReport(report)
    expect(brief.done[0].line).toContain('Витрина X')
    expect(brief.done[0].line).toContain('✓ 20.03')
  })
})

describe('briefDate', () => {
  it('formats as DD.MM', () => {
    expect(briefDate('2024-03-20')).toBe('20.03')
    expect(briefDateRange('2024-03-01', '2024-03-20')).toBe('01.03–20.03')
  })
})
