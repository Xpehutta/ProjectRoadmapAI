import type { SubStage } from '../types'
import { addDays, fmtDate, parseDate } from './dateShift'

export function sortedSubStages(stages: SubStage[]): SubStage[] {
  return [...stages].sort((a, b) => a.sort_order - b.sort_order)
}

export function stageEffectiveEndDate(stage: SubStage): string | null {
  return stage.end_date ?? stage.due_date ?? stage.start_date
}

export function precedingEndBeforeStart(startDate: string): string | null {
  const start = parseDate(startDate)
  if (!start) return null
  return fmtDate(addDays(start, -1))
}

export function followingStartAfterEnd(endDate: string): string | null {
  const end = parseDate(endDate)
  if (!end) return null
  return fmtDate(addDays(end, 1))
}

export function stageNeedsPrecedingEndFill(
  stages: SubStage[],
  stageIndex: number,
  startDate: string | null
): { preceding: SubStage; proposedEnd: string } | null {
  if (!startDate || stageIndex <= 0) return null
  const sorted = sortedSubStages(stages)
  const preceding = sorted[stageIndex - 1]
  if (!preceding || stageEffectiveEndDate(preceding)) return null
  const proposedEnd = precedingEndBeforeStart(startDate)
  if (!proposedEnd) return null
  return { preceding, proposedEnd }
}

/** When adding a new stage without start date, suggest start = last stage end + 1. */
export function stageNeedsFollowingStartFill(
  stages: SubStage[],
  startDate: string | null
): { preceding: SubStage; proposedStart: string } | null {
  if (startDate || stages.length === 0) return null
  const sorted = sortedSubStages(stages)
  const preceding = sorted[sorted.length - 1]
  const end = stageEffectiveEndDate(preceding)
  if (!end) return null
  const proposedStart = followingStartAfterEnd(end)
  if (!proposedStart) return null
  return { preceding, proposedStart }
}
