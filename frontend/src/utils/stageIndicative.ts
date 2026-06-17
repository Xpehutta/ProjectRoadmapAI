import type { SubStage } from '../types'
import { stageEffectiveEndDate } from './subStageDates'

function stageEffectiveStartDate(stage: SubStage): string | null {
  return stage.start_date ?? stage.end_date ?? stage.due_date
}

/** Min start and max end across all sub-stages (planned dates). */
export function indicativeDatesFromStages(stages: SubStage[]): {
  start: string | null
  end: string | null
} {
  if (!stages.length) return { start: null, end: null }

  const starts: string[] = []
  const ends: string[] = []
  for (const stage of stages) {
    const start = stageEffectiveStartDate(stage)
    const end = stageEffectiveEndDate(stage)
    if (start) starts.push(start)
    if (end) ends.push(end)
  }

  return {
    start: starts.length ? starts.reduce((min, d) => (d < min ? d : min)) : null,
    end: ends.length ? ends.reduce((max, d) => (d > max ? d : max)) : null,
  }
}
