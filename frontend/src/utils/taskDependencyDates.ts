import type { Dependency, DependencyType, ProjectDetail, SubStage, Task } from '../types'
import { parseDate } from './dateShift'
import { followingStartAfterEnd, stageEffectiveEndDate, sortedSubStages } from './subStageDates'
import { stageDisplayNumber } from './subStageDeps'
import type { TaskDependencyDraft } from './taskDependencyRefs'
import { suggestedStartFromInternalStagePredecessors } from './stageInternalDeps'

export interface DependencyStartSuggestion {
  date: string
  label: string
}

function taskFactEnd(task: Task): string | null {
  return task.end_date ?? task.indicative_end ?? null
}

function predecessorAnchorDate(
  dep: Dependency,
  tasksById: Map<number, Task>,
  edge: 'start' | 'end'
): string | null {
  const predTask = tasksById.get(dep.predecessor_id)
  if (!predTask) return null

  if (dep.predecessor_stage_id != null) {
    const stage = (predTask.sub_stages ?? []).find((s) => s.id === dep.predecessor_stage_id)
    if (!stage) return null
    if (edge === 'end') return stageEffectiveEndDate(stage)
    return stage.start_date ?? stage.due_date ?? stage.end_date ?? null
  }

  if (edge === 'end') {
    const taskEnd = taskFactEnd(predTask)
    if (taskEnd) return taskEnd
    const stages = sortedSubStages(predTask.sub_stages ?? [])
    const ends = stages
      .map((s) => stageEffectiveEndDate(s))
      .filter((d): d is string => Boolean(d))
    if (!ends.length) return null
    return ends.sort()[ends.length - 1] ?? null
  }

  return predTask.start_date ?? predTask.indicative_start ?? null
}

function suggestedStartForDep(
  dep: Dependency,
  tasksById: Map<number, Task>
): string | null {
  const type: DependencyType = dep.type ?? 'FS'
  if (type === 'FS') {
    const anchor = predecessorAnchorDate(dep, tasksById, 'end')
    if (!anchor) return null
    return followingStartAfterEnd(anchor)
  }
  if (type === 'FF') {
    return predecessorAnchorDate(dep, tasksById, 'end')
  }
  if (type === 'SS' || type === 'SF') {
    return predecessorAnchorDate(dep, tasksById, 'start')
  }
  return null
}

function buildSuggestionLabel(dep: Dependency, tasksById: Map<number, Task>): string {
  const pred = tasksById.get(dep.predecessor_id)
  if (!pred) return ''
  if (dep.predecessor_stage_id != null) {
    const stage = (pred.sub_stages ?? []).find((s) => s.id === dep.predecessor_stage_id)
    if (stage) return `${pred.name} / ${stage.name}`
  }
  return pred.name
}

function depAppliesToStage(dep: Dependency, stageId: number | undefined): boolean {
  if (stageId === undefined) {
    return dep.successor_stage_id == null
  }
  if (dep.successor_stage_id == null) return false
  return dep.successor_stage_id === stageId
}

export function suggestedStartFromDependencyDraft(
  draft: TaskDependencyDraft,
  tasksById: Map<number, Task>
): DependencyStartSuggestion | null {
  const predTask = tasksById.get(draft.predecessorId)
  if (!predTask) return null

  const virtualDep: Dependency = {
    id: 0,
    project_id: predTask.project_id,
    predecessor_id: draft.predecessorId,
    successor_id: 0,
    type: draft.type,
    lag_days: 0,
    predecessor_stage_id:
      draft.predecessorStageNumber != null
        ? sortedSubStages(predTask.sub_stages ?? [])[draft.predecessorStageNumber - 1]?.id ?? null
        : null,
    successor_stage_id: null,
  }

  const start = suggestedStartForDep(virtualDep, tasksById)
  if (!start) return null

  let label = predTask.name
  if (draft.predecessorStageNumber != null) {
    const stage = sortedSubStages(predTask.sub_stages ?? [])[draft.predecessorStageNumber - 1]
    if (stage) label = `${predTask.name} / ${stage.name}`
  }

  return { date: start, label }
}

export function suggestedStartFromDependencyDrafts(
  drafts: TaskDependencyDraft[],
  task: Task,
  tasksById: Map<number, Task>,
  stageId?: number
): DependencyStartSuggestion | null {
  const ordered = sortedSubStages(task.sub_stages ?? [])
  let targetStageNumber: number | null = null
  if (stageId !== undefined) {
    const idx = ordered.findIndex((s) => s.id === stageId)
    if (idx < 0) return null
    targetStageNumber = stageDisplayNumber(idx)
  }

  let best: DependencyStartSuggestion | null = null
  for (const draft of drafts) {
    if (!draft.predecessorId) continue
    if (targetStageNumber !== null) {
      if (draft.successorStageNumber !== targetStageNumber) continue
    } else if (draft.successorStageNumber != null) {
      continue
    }
    const suggestion = suggestedStartFromDependencyDraft(draft, tasksById)
    if (!suggestion) continue
    if (!best || suggestion.date > best.date) best = suggestion
  }
  return best
}

/** Latest applicable start date from incoming task dependencies (FS: pred end = start). */
export function suggestedStartFromDependencies(
  project: ProjectDetail,
  task: Task,
  tasksById: Map<number, Task>,
  stageId?: number
): DependencyStartSuggestion | null {
  const incoming = project.dependencies.filter((d) => d.successor_id === task.id)
  let best: DependencyStartSuggestion | null = null

  for (const dep of incoming) {
    if (!depAppliesToStage(dep, stageId)) continue
    const start = suggestedStartForDep(dep, tasksById)
    if (!start) continue
    if (!best || start > best.date) {
      best = { date: start, label: buildSuggestionLabel(dep, tasksById) }
    }
  }

  return best
}

function mergeSuggestions(
  a: DependencyStartSuggestion | null,
  b: DependencyStartSuggestion | null
): DependencyStartSuggestion | null {
  if (!a) return b
  if (!b) return a
  return a.date >= b.date ? a : b
}

function suggestedStartFromInternalStageLinks(
  task: Task,
  stageId?: number
): DependencyStartSuggestion | null {
  if (stageId === undefined) return null
  return suggestedStartFromInternalStagePredecessors(task.sub_stages ?? [], stageId)
}

export function suggestedStartFromAllDependencies(
  project: ProjectDetail,
  task: Task,
  tasksById: Map<number, Task>,
  dependencyDrafts: TaskDependencyDraft[],
  stageId?: number,
  draftsAuthoritative = false
): DependencyStartSuggestion | null {
  const fromInternal = suggestedStartFromInternalStageLinks(task, stageId)
  const fromDrafts = suggestedStartFromDependencyDrafts(
    dependencyDrafts,
    task,
    tasksById,
    stageId
  )
  if (draftsAuthoritative) {
    return mergeSuggestions(fromDrafts, fromInternal)
  }
  return mergeSuggestions(
    mergeSuggestions(fromDrafts, suggestedStartFromDependencies(project, task, tasksById, stageId)),
    fromInternal
  )
}

export function stageNeedsDependencyStartFill(
  project: ProjectDetail,
  task: Task,
  stage: SubStage,
  tasksById: Map<number, Task>,
  dependencyDrafts: TaskDependencyDraft[],
  currentStart: string | null,
  draftsAuthoritative = false
): DependencyStartSuggestion | null {
  if (currentStart) return null
  return suggestedStartFromAllDependencies(
    project,
    task,
    tasksById,
    dependencyDrafts,
    stage.id,
    draftsAuthoritative
  )
}

export function taskNeedsDependencyStartFill(
  project: ProjectDetail,
  task: Task,
  tasksById: Map<number, Task>,
  dependencyDrafts: TaskDependencyDraft[],
  currentStart: string | null,
  draftsAuthoritative = false
): DependencyStartSuggestion | null {
  if (currentStart) return null
  return suggestedStartFromAllDependencies(
    project,
    task,
    tasksById,
    dependencyDrafts,
    undefined,
    draftsAuthoritative
  )
}

export function isValidDateString(value: string): boolean {
  return parseDate(value) != null
}
