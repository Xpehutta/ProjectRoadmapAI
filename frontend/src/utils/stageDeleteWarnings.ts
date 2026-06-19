import type { ProjectDetail, SubStage, Task } from '../types'
import { sortedSubStages } from './subStageDates'
import { stageDisplayNumber } from './subStageDeps'
import type { TaskDependencyDraft } from './taskDependencyRefs'

export interface StageDeleteWarning {
  message: string
}

function stageLabel(task: Task, stageId: number): string {
  const stages = sortedSubStages(task.sub_stages ?? [])
  const idx = stages.findIndex((s) => s.id === stageId)
  if (idx < 0) return task.name
  return `${task.name} / ${stageDisplayNumber(idx)}. ${stages[idx].name}`
}

export function adjustDependencyDraftsAfterStageDelete(
  drafts: TaskDependencyDraft[],
  deletedStageNumber: number
): TaskDependencyDraft[] {
  return drafts
    .filter((d) => d.successorStageNumber !== deletedStageNumber)
    .map((d) => {
      if (d.successorStageNumber != null && d.successorStageNumber > deletedStageNumber) {
        return { ...d, successorStageNumber: d.successorStageNumber - 1 }
      }
      return d
    })
}

export function collectStageDeleteWarnings(
  project: ProjectDetail,
  task: Task,
  stage: SubStage,
  stageIndex: number,
  orderedStages: SubStage[],
  dependencyDrafts: TaskDependencyDraft[],
  tasksById: Map<number, Task>
): StageDeleteWarning[] {
  const warnings: StageDeleteWarning[] = []
  const stageNumber = stageDisplayNumber(stageIndex)
  const seen = new Set<string>()

  const add = (message: string) => {
    if (seen.has(message)) return
    seen.add(message)
    warnings.push({ message })
  }

  for (const other of orderedStages) {
    if (other.id === stage.id) continue
    const preds = other.predecessor_stage_ids ?? []
    if (!preds.includes(stage.id)) continue
    const otherIdx = orderedStages.findIndex((s) => s.id === other.id)
    add(
      `Этап «${other.name}» (${stageDisplayNumber(otherIdx)}) ссылается на этот этап как на предшественника`
    )
  }

  for (const dep of project.dependencies) {
    if (dep.predecessor_id === task.id && dep.predecessor_stage_id === stage.id) {
      const succ = tasksById.get(dep.successor_id)
      if (!succ) continue
      const label =
        dep.successor_stage_id != null
          ? stageLabel(succ, dep.successor_stage_id)
          : succ.name
      add(`Задача «${label}» зависит от этого этапа`)
    }
    if (dep.successor_id === task.id && dep.successor_stage_id === stage.id) {
      const pred = tasksById.get(dep.predecessor_id)
      if (!pred) continue
      const label =
        dep.predecessor_stage_id != null
          ? stageLabel(pred, dep.predecessor_stage_id)
          : pred.name
      add(`Этот этап зависит от «${label}»`)
    }
  }

  for (const draft of dependencyDrafts) {
    if (draft.successorStageNumber !== stageNumber) continue
    const pred = tasksById.get(draft.predecessorId)
    if (!pred) continue
    let label = pred.name
    if (draft.predecessorStageNumber != null) {
      const predStages = sortedSubStages(pred.sub_stages ?? [])
      const predStage = predStages[draft.predecessorStageNumber - 1]
      if (predStage) label = `${pred.name} / ${predStage.name}`
    }
    add(`Несохранённая зависимость от «${label}» привязана к этому этапу`)
  }

  return warnings
}
