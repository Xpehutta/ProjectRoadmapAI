import type { SubStage } from '../types'
import { fmtDate } from './dateShift'
import { isStagePlanned } from './stageComplete'
import { stageEffectiveEndDate } from './subStageDates'

export function todayIso(): string {
  return fmtDate(new Date())
}

/** Planned stage whose date range includes today and is not completed. */
export function isStageActiveToday(stage: SubStage, today = todayIso()): boolean {
  if (!isStagePlanned(stage) || stage.is_done) return false
  const start = stage.start_date
  const end = stageEffectiveEndDate(stage)
  if (!start && !end) return false
  const rangeStart = start ?? end!
  const rangeEnd = end ?? start!
  return today >= rangeStart && today <= rangeEnd
}

export function activeStagesToday(stages: SubStage[], today = todayIso()): SubStage[] {
  return stages.filter((stage) => isStageActiveToday(stage, today))
}
