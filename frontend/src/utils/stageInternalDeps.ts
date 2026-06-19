import type { StageInternalLink, StageInternalLinkRelation, SubStage, Task } from '../types'
import { followingStartAfterEnd, sortedSubStages, stageEffectiveEndDate } from './subStageDates'
import { stageDisplayNumber } from './subStageDeps'

export interface StageFocusDependency {
  refStageId: number
  relation: StageInternalLinkRelation
}

export interface InternalStageStartSuggestion {
  date: string
  label: string
}

export function linkFromDependency(
  focusStageId: number,
  dep: StageFocusDependency
): StageInternalLink {
  return {
    first_stage_id: dep.refStageId,
    second_stage_id: focusStageId,
    relation: dep.relation,
  }
}

/** Interpret stored link relative to focus stage (canonical or legacy encoding). */
export function dependencyFromLink(
  focusStageId: number,
  link: StageInternalLink
): StageFocusDependency | null {
  const { first_stage_id: first, second_stage_id: second, relation } = link
  if (second === focusStageId) {
    return { refStageId: first, relation }
  }
  if (first === focusStageId && relation === 'after') {
    return { refStageId: second, relation: 'before' }
  }
  return null
}

export function dedupeInternalStageLinks(links: StageInternalLink[]): StageInternalLink[] {
  const out: StageInternalLink[] = []
  const seen = new Set<string>()
  for (const link of links) {
    const key = `${link.first_stage_id}-${link.second_stage_id}-${link.relation}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(link)
  }
  return out
}

export function linksFromPredecessorIds(stages: SubStage[]): StageInternalLink[] {
  const ordered = sortedSubStages(stages)
  const links: StageInternalLink[] = []
  for (const succ of ordered) {
    for (const predId of succ.predecessor_stage_ids ?? []) {
      links.push({
        first_stage_id: predId,
        second_stage_id: succ.id,
        relation: 'after',
      })
    }
  }
  return dedupeInternalStageLinks(links)
}

export function effectiveInternalStageLinks(task: Task, stages: SubStage[]): StageInternalLink[] {
  if (task.internal_stage_links?.length) {
    return dedupeInternalStageLinks(task.internal_stage_links)
  }
  return linksFromPredecessorIds(stages)
}

export function dependenciesForFocusStage(
  focusStageId: number,
  links: StageInternalLink[]
): StageFocusDependency[] {
  const out: StageFocusDependency[] = []
  const seen = new Set<string>()
  for (const link of links) {
    const dep = dependencyFromLink(focusStageId, link)
    if (!dep) continue
    const key = `${dep.refStageId}:${dep.relation}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(dep)
  }
  return out.sort((a, b) => a.refStageId - b.refStageId)
}

export function replaceDependenciesForFocusStage(
  allLinks: StageInternalLink[],
  focusStageId: number,
  deps: StageFocusDependency[]
): StageInternalLink[] {
  const without = allLinks.filter((link) => dependencyFromLink(focusStageId, link) === null)
  const added = deps.map((dep) => linkFromDependency(focusStageId, dep))
  return dedupeInternalStageLinks([...without, ...added])
}

export function mergeDependenciesForNewStage(
  allLinks: StageInternalLink[],
  newStageId: number,
  deps: StageFocusDependency[]
): StageInternalLink[] {
  return replaceDependenciesForFocusStage(allLinks, newStageId, deps)
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

export function stageOptionsForInternalDeps(
  stages: SubStage[],
  excludeStageId?: number
): { id: number; number: number; label: string }[] {
  return sortedSubStages(stages)
    .map((stage, index) => ({
      id: stage.id,
      number: stageDisplayNumber(index),
      label: `${stageDisplayNumber(index)}. ${stage.name}`,
    }))
    .filter((opt) => opt.id !== excludeStageId)
}
