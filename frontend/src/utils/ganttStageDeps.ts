import type { SubStage } from '../types'
import { parseDate } from './dateShift'
import { ganttBarEndX } from './ganttBar'
import { sortedSubStages, stageEffectiveEndDate } from './subStageDates'
import { stageDisplayNumber } from './subStageDeps'

export interface StageBarRange {
  start: Date
  end: Date
}

export interface StageDependencyLink {
  key: string
  predStageId: number
  succStageId: number
  predNumber: number
  succNumber: number
  predName: string
  succName: string
  predEnd: Date
  predStart: Date
  succStart: Date
}

export function getStageBarRange(stage: SubStage): StageBarRange | null {
  if (!stage.is_indicative) return null
  const start = parseDate(stage.start_date)
  const end = parseDate(stageEffectiveEndDate(stage))
  if (!start && !end) return null
  const barStart = start ?? end!
  const barEnd = end ?? start!
  if (barEnd.getTime() < barStart.getTime()) {
    return { start: barEnd, end: barStart }
  }
  return { start: barStart, end: barEnd }
}

export function collectStageDependencyLinks(stages: SubStage[]): StageDependencyLink[] {
  const ordered = sortedSubStages(stages)
  const rangeById = new Map<number, StageBarRange>()
  for (const stage of ordered) {
    const range = getStageBarRange(stage)
    if (range) rangeById.set(stage.id, range)
  }

  const links: StageDependencyLink[] = []
  for (const succ of ordered) {
    const predIds = succ.predecessor_stage_ids ?? []
    if (!predIds.length) continue

    const succIndex = ordered.findIndex((s) => s.id === succ.id)
    const succRange = rangeById.get(succ.id)
    if (!succRange) continue

    for (const predId of predIds) {
      const predIndex = ordered.findIndex((s) => s.id === predId)
      if (predIndex < 0) continue
      const predRange = rangeById.get(predId)
      if (!predRange) continue

      links.push({
        key: `${predId}-${succ.id}`,
        predStageId: predId,
        succStageId: succ.id,
        predNumber: stageDisplayNumber(predIndex),
        succNumber: stageDisplayNumber(succIndex),
        predName: ordered[predIndex].name,
        succName: succ.name,
        predEnd: predRange.end,
        predStart: predRange.start,
        succStart: succRange.start,
      })
    }
  }

  return links
}

export function stageDependencyFromX(
  predEnd: Date,
  predStart: Date,
  dayWidth: number,
  xForDate: (d: Date) => number
): number {
  return ganttBarEndX(predStart, predEnd, dayWidth, xForDate, 4)
}

export function stageDependencyToX(succStart: Date, xForDate: (d: Date) => number): number {
  return xForDate(succStart)
}
