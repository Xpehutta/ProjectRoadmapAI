import { describe, expect, it } from 'vitest'
import type { SubStage } from '../types'
import {
  buildStageShiftEntry,
  indicativeRangeChanged,
  isStagePlanned,
  stageDatesChanged,
} from './stageComplete'

function stage(overrides: Partial<SubStage> = {}): SubStage {
  return {
    id: 1,
    task_id: 1,
    name: 'Этап',
    sort_order: 0,
    start_date: '2024-01-01',
    end_date: '2024-01-10',
    due_date: '2024-01-10',
    is_done: false,
    is_indicative: true,
    note: null,
    predecessor_stage_ids: [],
    ...overrides,
  }
}

describe('isStagePlanned', () => {
  it('returns true only when is_indicative is true', () => {
    expect(isStagePlanned(stage({ is_indicative: true }))).toBe(true)
    expect(isStagePlanned(stage({ is_indicative: false }))).toBe(false)
    expect(isStagePlanned(stage({ is_indicative: undefined as unknown as boolean }))).toBe(false)
  })
})

describe('stageDatesChanged', () => {
  it('detects start/end changes against planned dates', () => {
    const s = stage()
    expect(stageDatesChanged(s, { start_date: '2024-01-01', end_date: '2024-01-10' })).toBe(false)
    expect(stageDatesChanged(s, { start_date: '2024-01-02', end_date: '2024-01-10' })).toBe(true)
  })
})

describe('indicativeRangeChanged', () => {
  it('compares indicative ranges', () => {
    const before = { start: '2024-01-01', end: '2024-01-31' }
    expect(indicativeRangeChanged(before, before)).toBe(false)
    expect(indicativeRangeChanged(before, { start: '2024-01-02', end: '2024-01-31' })).toBe(true)
  })
})

describe('buildStageShiftEntry', () => {
  it('returns null when dates unchanged', () => {
    const s = stage()
    expect(
      buildStageShiftEntry(1, s, { start_date: '2024-01-01', end_date: '2024-01-10' })
    ).toBeNull()
  })

  it('builds shift entry when dates change', () => {
    const s = stage()
    const entry = buildStageShiftEntry(
      1,
      s,
      { start_date: '2024-01-02', end_date: '2024-01-12' },
      'сдвиг'
    )
    expect(entry).toMatchObject({
      taskId: 1,
      stageId: 1,
      origStart: '2024-01-01',
      origEnd: '2024-01-10',
      curStart: '2024-01-02',
      curEnd: '2024-01-12',
      shiftComment: 'сдвиг',
    })
  })
})
