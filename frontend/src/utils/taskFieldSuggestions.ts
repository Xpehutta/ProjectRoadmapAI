import type { ProjectComponent, Task } from '../types'

export type SuggestibleTaskField =
  | 'subproduct'
  | 'data_source'
  | 'forms'
  | 'customer'
  | 'platform'
  | 'area'

export function collectTaskFieldSuggestions(
  tasks: Task[],
  field: SuggestibleTaskField,
  components?: ProjectComponent[]
): string[] {
  const values = new Set<string>()

  const add = (raw: string | null | undefined) => {
    const trimmed = raw?.trim()
    if (trimmed) values.add(trimmed)
  }

  for (const task of tasks) {
    if (field === 'data_source') {
      add(task.data_source)
      add(task.component_name)
    } else {
      add(task[field])
    }
  }

  if (field === 'data_source' && components) {
    for (const component of components) {
      add(component.data_source)
      add(component.name)
    }
  }

  return [...values].sort((a, b) => a.localeCompare(b, 'ru'))
}

export function collectGeneralTabFieldSuggestions(
  tasks: Task[],
  components?: ProjectComponent[]
): Record<SuggestibleTaskField, string[]> {
  return {
    subproduct: collectTaskFieldSuggestions(tasks, 'subproduct'),
    data_source: collectTaskFieldSuggestions(tasks, 'data_source', components),
    forms: collectTaskFieldSuggestions(tasks, 'forms'),
    customer: collectTaskFieldSuggestions(tasks, 'customer'),
    platform: collectTaskFieldSuggestions(tasks, 'platform'),
    area: collectTaskFieldSuggestions(tasks, 'area'),
  }
}

/** Parse stored value for HTML date input (YYYY-MM-DD only). */
export function isoDateInputValue(raw: string | null | undefined): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : ''
}
