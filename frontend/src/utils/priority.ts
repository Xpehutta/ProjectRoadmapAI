import type { Task } from '../types'

export type PriorityFilterKey = number | 'none'

export const PRIORITY_ORDER: PriorityFilterKey[] = [1, 2, 3, 'none']

export const PRIORITY_COLORS: Record<string, string> = {
  '1': '#dc2626',
  '2': '#ea580c',
  '3': '#2563eb',
  none: '#94a3b8',
}

export function priorityKey(task: Task): PriorityFilterKey {
  return task.priority ?? 'none'
}

export function priorityColor(priority: number | null | undefined): string {
  if (priority == null) return PRIORITY_COLORS.none
  return PRIORITY_COLORS[String(priority)] ?? PRIORITY_COLORS.none
}

export function priorityLabel(priority: number | null | undefined): string {
  if (priority == null) return '—'
  return `P${priority}`
}

export function collectPriorityKeys(tasks: Task[]): PriorityFilterKey[] {
  const keys = new Set<PriorityFilterKey>()
  for (const task of tasks) keys.add(priorityKey(task))
  return PRIORITY_ORDER.filter((k) => keys.has(k))
}

export function filterTasksByPriority(
  tasks: Task[],
  filter: PriorityFilterKey[] | null
): Task[] {
  if (filter === null) return tasks
  if (filter.length === 0) return []
  const allowed = new Set(filter)
  return tasks.filter((t) => allowed.has(priorityKey(t)))
}

export function isPriorityFilterActive(
  key: PriorityFilterKey,
  filter: PriorityFilterKey[] | null
): boolean {
  if (filter === null) return true
  return filter.includes(key)
}

export function togglePriorityFilter(
  key: PriorityFilterKey,
  allKeys: PriorityFilterKey[],
  current: PriorityFilterKey[] | null
): PriorityFilterKey[] | null {
  if (allKeys.length === 0) return null
  if (current === null) {
    const next = allKeys.filter((k) => k !== key)
    return next.length === allKeys.length ? null : next
  }
  if (current.includes(key)) {
    const next = current.filter((k) => k !== key)
    return next.length === 0 ? [] : next
  }
  const next = [...current, key]
  return next.length === allKeys.length ? null : next
}
