import type { SubStage } from '../types'
import { parseDate } from './dateShift'
import { stageEffectiveEndDate } from './subStageDates'

function stageEffectiveStartDate(stage: SubStage): string | null {
  return stage.start_date ?? stage.end_date ?? stage.due_date
}

function inclusiveDaysBetween(start: string, end: string): number {
  const a = parseDate(start)
  const b = parseDate(end)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

/** Min start and max end across completed sub-stages (is_done). */
export function actualDatesFromCompletedStages(stages: SubStage[]): {
  start: string | null
  end: string | null
} {
  const done = stages.filter((s) => s.is_done)
  if (!done.length) return { start: null, end: null }

  const starts: string[] = []
  const ends: string[] = []
  for (const stage of done) {
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

export function completionPctFromStages(stages: SubStage[]): number {
  if (!stages.length) return 0
  const done = stages.filter((s) => s.is_done).length
  return Math.round((done / stages.length) * 100)
}

export function durationDaysFromStageRange(
  start: string | null,
  end: string | null
): number | null {
  if (!start || !end) return null
  return inclusiveDaysBetween(start, end)
}

/** Min start and max end across planned sub-stages (is_indicative). */
export function indicativeDatesFromStages(stages: SubStage[]): {
  start: string | null
  end: string | null
} {
  const planned = stages.filter((s) => s.is_indicative)
  if (!planned.length) return { start: null, end: null }

  const starts: string[] = []
  const ends: string[] = []
  for (const stage of planned) {
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
