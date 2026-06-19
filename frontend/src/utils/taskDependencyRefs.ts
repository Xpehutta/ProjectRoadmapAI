import type { DependencyType, PredecessorRef, SubStage, Task } from '../types'
import { sortedSubStages } from './subStageDates'
import { stageDisplayNumber } from './subStageDeps'

export interface TaskDependencyDraft {
  predecessorId: number
  type: DependencyType
  predecessorStageNumber: number | null
  successorStageNumber: number | null
}

export function formatPredecessorRef(
  pred: Pick<
    PredecessorRef,
    'name' | 'type' | 'predecessor_stage_number' | 'successor_stage_number'
  >
): string {
  let token = pred.name
  if (pred.predecessor_stage_number != null) {
    token = `${token}:${pred.predecessor_stage_number}`
  }
  if (pred.successor_stage_number != null) {
    token = `${token}>${pred.successor_stage_number}`
  }
  if (pred.type && pred.type !== 'FS') {
    token = `${token}@${pred.type}`
  }
  return token
}

export function formatPredecessorRefs(predecessors: PredecessorRef[]): string {
  return predecessors.map((p) => formatPredecessorRef(p)).join(', ')
}

export function predecessorRefLabel(pred: PredecessorRef): string {
  const base = formatPredecessorRef(pred)
  if (pred.predecessor_stage_name || pred.successor_stage_name) {
    const parts: string[] = []
    if (pred.predecessor_stage_name) {
      parts.push(
        pred.predecessor_stage_number != null
          ? `${pred.predecessor_stage_number}. ${pred.predecessor_stage_name}`
          : pred.predecessor_stage_name
      )
    }
    if (pred.successor_stage_name) {
      parts.push(
        pred.successor_stage_number != null
          ? `→ ${pred.successor_stage_number}. ${pred.successor_stage_name}`
          : `→ ${pred.successor_stage_name}`
      )
    }
    if (parts.length) return `${base} (${parts.join(' ')})`
  }
  return base
}

export function draftsFromPredecessors(predecessors: PredecessorRef[]): TaskDependencyDraft[] {
  return predecessors.map((p) => ({
    predecessorId: p.id,
    type: p.type,
    predecessorStageNumber: p.predecessor_stage_number ?? null,
    successorStageNumber: p.successor_stage_number ?? null,
  }))
}

export function draftsToPredecessorRefs(drafts: TaskDependencyDraft[], tasksById: Map<number, Task>): string[] {
  return drafts.map((draft) => {
    const task = tasksById.get(draft.predecessorId)
    if (!task) return String(draft.predecessorId)
    let token = task.name
    if (draft.predecessorStageNumber != null) {
      token = `${token}:${draft.predecessorStageNumber}`
    }
    if (draft.successorStageNumber != null) {
      token = `${token}>${draft.successorStageNumber}`
    }
    if (draft.type !== 'FS') {
      token = `${token}@${draft.type}`
    }
    return token
  })
}

export function stageOptions(stages: SubStage[]): { number: number; label: string }[] {
  return sortedSubStages(stages).map((stage, index) => ({
    number: stageDisplayNumber(index),
    label: `${stageDisplayNumber(index)}. ${stage.name}`,
  }))
}

export function parsePredecessorRefsText(
  raw: string,
  currentTaskId: number,
  tasksById: Map<number, Task>,
  tasksByName: Map<string, Task>
): TaskDependencyDraft[] | null {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const drafts: TaskDependencyDraft[] = []
  for (const token of trimmed.split(/[,;]+/)) {
    const part = token.trim()
    if (!part) continue

    let text = part
    let depType: DependencyType = 'FS'
    if (text.includes('@')) {
      const at = text.lastIndexOf('@')
      const typeRaw = text.slice(at + 1).trim().toUpperCase()
      text = text.slice(0, at).trim()
      if (['FS', 'SS', 'FF', 'SF'].includes(typeRaw)) {
        depType = typeRaw as DependencyType
      } else {
        return null
      }
    }

    let successorStageNumber: number | null = null
    if (text.includes('>')) {
      const [left, right] = text.split('>', 2)
      text = left.trim()
      const succNum = Number(right.trim())
      if (!Number.isInteger(succNum) || succNum < 1) return null
      successorStageNumber = succNum
    }

    let predecessorStageNumber: number | null = null
    if (text.includes(':')) {
      const idx = text.lastIndexOf(':')
      const maybeNum = text.slice(idx + 1).trim()
      const num = Number(maybeNum)
      if (Number.isInteger(num) && num >= 1) {
        predecessorStageNumber = num
        text = text.slice(0, idx).trim()
      }
    }

    const byId = tasksById.get(Number(text))
    const predTask = byId ?? tasksByName.get(text.toLowerCase())
    if (!predTask || predTask.id === currentTaskId) return null

    if (predecessorStageNumber != null) {
      const predStages = sortedSubStages(predTask.sub_stages ?? [])
      if (predecessorStageNumber > predStages.length) return null
    }

    drafts.push({
      predecessorId: predTask.id,
      type: depType,
      predecessorStageNumber,
      successorStageNumber,
    })
  }

  return drafts
}
