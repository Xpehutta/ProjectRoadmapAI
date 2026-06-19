import type { SubStage } from '../types'
import type { SavedStageDateShift } from '../stores/savedDateShiftsStore'
import { stageEffectiveEndDate } from './subStageDates'

export function stagePlannedDates(stage: SubStage): {
  start_date: string | null
  end_date: string | null
} {
  return {
    start_date: stage.start_date,
    end_date: stageEffectiveEndDate(stage),
  }
}

/** Stage is on the Gantt / counts toward task indicative dates. */
export function isStagePlanned(stage: SubStage): boolean {
  return stage.is_indicative === true
}

export function stageDatesChanged(
  stage: SubStage,
  confirmed: { start_date: string | null; end_date: string | null }
): boolean {
  const planned = stagePlannedDates(stage)
  const norm = (v: string | null | undefined) => v || null
  return (
    norm(planned.start_date) !== norm(confirmed.start_date) ||
    norm(planned.end_date) !== norm(confirmed.end_date)
  )
}

export function indicativeRangeChanged(
  before: { start: string | null; end: string | null },
  after: { start: string | null; end: string | null }
): boolean {
  return before.start !== after.start || before.end !== after.end
}

function shiftDateOrFallback(primary: string | null, fallback: string | null): string | null {
  return primary ?? fallback
}

export function buildStageShiftEntry(
  taskId: number,
  stage: SubStage,
  confirmed: { start_date: string | null; end_date: string | null },
  comment?: string
): SavedStageDateShift | null {
  if (!stageDatesChanged(stage, confirmed)) return null
  const planned = stagePlannedDates(stage)
  const origStart = shiftDateOrFallback(planned.start_date, planned.end_date)
  const origEnd = shiftDateOrFallback(planned.end_date, planned.start_date)
  const curStart = shiftDateOrFallback(confirmed.start_date, confirmed.end_date)
  const curEnd = shiftDateOrFallback(confirmed.end_date, confirmed.start_date)
  if (!origStart || !origEnd || !curStart || !curEnd) return null
  return {
    taskId,
    stageId: stage.id,
    stageName: stage.name,
    origStart,
    origEnd,
    curStart,
    curEnd,
    shiftComment: comment?.trim() || undefined,
  }
}
