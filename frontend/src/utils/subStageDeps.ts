import type { SubStage } from '../types'

export function stageDisplayNumber(stageIndex: number): number {
  return stageIndex + 1
}

export function stageIdByNumber(orderedStages: SubStage[], number: number): number | null {
  const stage = orderedStages[number - 1]
  return stage?.id ?? null
}

export function formatStagePredecessorNumbers(
  stage: SubStage,
  orderedStages: SubStage[]
): string {
  const ids = stage.predecessor_stage_ids ?? []
  if (!ids.length) return ''
  const numbers = ids
    .map((id) => {
      const idx = orderedStages.findIndex((s) => s.id === id)
      return idx >= 0 ? stageDisplayNumber(idx) : null
    })
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b)
  return numbers.join(', ')
}

/** Parse "1, 2" into stage ids; returns null if any token is invalid. */
export function parseStagePredecessorNumbers(
  raw: string,
  orderedStages: SubStage[],
  selfStageId: number
): number[] | null {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const tokens = trimmed
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  const ids: number[] = []
  const seen = new Set<number>()

  for (const token of tokens) {
    const num = Number(token)
    if (!Number.isInteger(num) || num < 1 || num > orderedStages.length) {
      return null
    }
    const id = stageIdByNumber(orderedStages, num)
    if (!id || id === selfStageId || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }

  return ids
}

export function formatStagePredecessorLabels(
  stage: SubStage,
  orderedStages: SubStage[]
): string {
  const ids = stage.predecessor_stage_ids ?? []
  if (!ids.length) return ''
  return ids
    .map((id) => {
      const idx = orderedStages.findIndex((s) => s.id === id)
      if (idx < 0) return null
      return `${stageDisplayNumber(idx)}. ${orderedStages[idx].name}`
    })
    .filter(Boolean)
    .join(' · ')
}
