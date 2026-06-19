import type { SubStage } from '../types'
import { followingStartAfterEnd, sortedSubStages, stageEffectiveEndDate } from './subStageDates'
import { stageDisplayNumber } from './subStageDeps'

export interface InternalStageLink {
  key: string
  predStageId: number
  succStageId: number
  predNumber: number
  succNumber: number
  predName: string
  succName: string
}

export function collectInternalStageLinks(stages: SubStage[]): InternalStageLink[] {
  const ordered = sortedSubStages(stages)
  const links: InternalStageLink[] = []

  for (const succ of ordered) {
    const succIndex = ordered.findIndex((s) => s.id === succ.id)
    for (const predId of succ.predecessor_stage_ids ?? []) {
      const predIndex = ordered.findIndex((s) => s.id === predId)
      if (predIndex < 0) continue
      links.push({
        key: `${predId}-${succ.id}`,
        predStageId: predId,
        succStageId: succ.id,
        predNumber: stageDisplayNumber(predIndex),
        succNumber: stageDisplayNumber(succIndex),
        predName: ordered[predIndex].name,
        succName: succ.name,
      })
    }
  }

  return links.sort((a, b) => a.succNumber - b.succNumber || a.predNumber - b.predNumber)
}

export interface InternalStageStartSuggestion {
  date: string
  label: string
}

export function suggestedStartFromInternalStagePred(
  stages: SubStage[],
  predStageId: number
): InternalStageStartSuggestion | null {
  const ordered = sortedSubStages(stages)
  const predIndex = ordered.findIndex((s) => s.id === predStageId)
  if (predIndex < 0) return null
  const pred = ordered[predIndex]
  const end = stageEffectiveEndDate(pred)
  if (!end) return null
  const start = followingStartAfterEnd(end)
  if (!start) return null
  return {
    date: start,
    label: `${stageDisplayNumber(predIndex)}. ${pred.name}`,
  }
}

export function suggestedStartFromInternalStagePredIds(
  stages: SubStage[],
  predStageIds: number[]
): InternalStageStartSuggestion | null {
  let best: InternalStageStartSuggestion | null = null
  for (const predId of predStageIds) {
    const suggestion = suggestedStartFromInternalStagePred(stages, predId)
    if (!suggestion) continue
    if (!best || suggestion.date > best.date) best = suggestion
  }
  return best
}

/** Latest start among internal stage predecessors (FS: day after pred end). */
export function suggestedStartFromInternalStagePredecessors(
  stages: SubStage[],
  succStageId: number
): InternalStageStartSuggestion | null {
  const ordered = sortedSubStages(stages)
  const succ = ordered.find((s) => s.id === succStageId)
  if (!succ) return null

  let best: InternalStageStartSuggestion | null = null
  for (const predId of succ.predecessor_stage_ids ?? []) {
    const suggestion = suggestedStartFromInternalStagePred(ordered, predId)
    if (!suggestion) continue
    if (!best || suggestion.date > best.date) best = suggestion
  }
  return best
}

export function stageOptionsForInternalDeps(stages: SubStage[]): { id: number; number: number; label: string }[] {
  return sortedSubStages(stages).map((stage, index) => ({
    id: stage.id,
    number: stageDisplayNumber(index),
    label: `${stageDisplayNumber(index)}. ${stage.name}`,
  }))
}
