import type { Task } from '../types'

/** Human-readable schedule line for cards and lists. */
export function formatTaskSchedule(task: Task, showIndicative: boolean): string | null {
  if (task.start_date && task.end_date) {
    return `${task.start_date} – ${task.end_date}`
  }
  if (task.start_date) {
    const endHint = task.end_date ?? (showIndicative ? task.indicative_end : null)
    if (endHint) return `${task.start_date} – ${endHint}`
    return `${task.start_date} – …`
  }
  if (showIndicative && task.indicative_start) {
    const end = task.indicative_end ?? '…'
    return `~ ${task.indicative_start} – ${end}`
  }
  return null
}

export function isIndicativeSchedule(task: Task): boolean {
  return Boolean(!task.end_date && (task.indicative_start || task.indicative_end))
}

export function displayDataSource(task: Task): string {
  return task.component_name ?? task.data_source ?? ''
}
