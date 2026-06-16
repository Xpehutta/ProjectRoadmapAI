import type { Moscow, PrioritizationMethod, Task } from '../types'

const MOSCOW_WEIGHT: Record<Moscow, number> = {
  must: 4,
  should: 3,
  could: 2,
  wont: 1,
}

export function riceScore(task: Task): number | null {
  const { rice_reach: reach, rice_impact: impact, rice_confidence: confidence, rice_effort: effort } = task
  if (reach == null || impact == null || confidence == null || effort == null || effort <= 0) return null
  return (reach * impact * (confidence / 100)) / effort
}

export function valueEffortScore(task: Task): number | null {
  const { value_score: value, effort_score: effort } = task
  if (value == null || effort == null || effort <= 0) return null
  return value / effort
}

export function moscowScore(task: Task): number | null {
  if (!task.moscow) return null
  return MOSCOW_WEIGHT[task.moscow]
}

export function prioritizationScore(task: Task, method: PrioritizationMethod): number | null {
  switch (method) {
    case 'rice':
      return riceScore(task)
    case 'value_effort':
      return valueEffortScore(task)
    case 'moscow':
      return moscowScore(task)
  }
}

export function formatScore(score: number | null, method: PrioritizationMethod): string {
  if (score == null) return '—'
  if (method === 'moscow') return score.toFixed(0)
  return score.toFixed(1)
}

export function sortByPrioritization(tasks: Task[], method: PrioritizationMethod): Task[] {
  return [...tasks].sort((a, b) => {
    const sa = prioritizationScore(a, method)
    const sb = prioritizationScore(b, method)
    if (sa == null && sb == null) return a.name.localeCompare(b.name)
    if (sa == null) return 1
    if (sb == null) return -1
    if (sb !== sa) return sb - sa
    return a.name.localeCompare(b.name)
  })
}

export const MOSCOW_OPTIONS: Moscow[] = ['must', 'should', 'could', 'wont']

export const PRIORITIZATION_METHODS: PrioritizationMethod[] = ['rice', 'value_effort', 'moscow']
