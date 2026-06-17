import type { SubStage } from '../types'
import { parseDate } from './dateShift'
import { sortedSubStages, stageEffectiveEndDate } from './subStageDates'

export interface CompletedStageBar {
  id: number
  name: string
  start: Date
  end: Date
}

export function getCompletedStageBars(stages: SubStage[]): CompletedStageBar[] {
  return sortedSubStages(stages).flatMap((stage) => {
    if (!stage.is_done) return []
    const start = parseDate(stage.start_date)
    const end = parseDate(stageEffectiveEndDate(stage))
    if (!start && !end) return []
    const barStart = start ?? end!
    const barEnd = end ?? start!
    return [
      {
        id: stage.id,
        name: stage.name,
        start: barStart,
        end: barEnd,
      },
    ]
  })
}
