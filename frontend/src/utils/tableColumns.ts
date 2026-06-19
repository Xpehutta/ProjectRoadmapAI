import type { ProjectDetail, Task, TaskStatus } from '../types'
import { ru, STATUS_OPTIONS } from '../locale/ru'
import { formatPredecessorRef } from './taskDependencyRefs'

export type TableColumnType = 'text' | 'textarea' | 'number' | 'date' | 'status' | 'category' | 'readonly'

export interface TableColumnDef {
  key: string
  label: string
  type: TableColumnType
  source: 'builtin' | 'custom'
}

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.id, s.label])) as Record<
  TaskStatus,
  string
>

/** Built-in columns in default display order (adaptive mode). */
export const BUILTIN_COLUMN_ORDER: { key: keyof Task | 'predecessors'; label: string; type: TableColumnType }[] = [
  { key: 'priority', label: 'Приоритет', type: 'number' },
  { key: 'status', label: 'Статус', type: 'status' },
  { key: 'category_id', label: 'Область', type: 'category' },
  { key: 'name', label: ru.table.usage, type: 'text' },
  { key: 'data_source', label: 'Источник', type: 'readonly' },
  { key: 'subproduct', label: 'Витрина', type: 'text' },
  { key: 'forms', label: 'Формы', type: 'text' },
  { key: 'customer', label: 'Заказчик', type: 'text' },
  { key: 'platform', label: 'Площадка', type: 'text' },
  { key: 'area', label: 'Область', type: 'text' },
  { key: 'assignee', label: 'Команда', type: 'text' },
  { key: 'contractor', label: 'Подрядчик', type: 'text' },
  { key: 'desired_quarter', label: 'Срок', type: 'text' },
  { key: 'attribute_count', label: 'Атрибуты', type: 'text' },
  { key: 'start_date', label: 'Начало', type: 'date' },
  { key: 'end_date', label: 'Окончание', type: 'date' },
  { key: 'indicative_start', label: 'Инд. начало', type: 'date' },
  { key: 'indicative_end', label: 'Инд. окончание', type: 'date' },
  { key: 'duration_days', label: 'Длительность', type: 'number' },
  { key: 'completion_pct', label: '%', type: 'readonly' },
  { key: 'risks', label: 'Риски', type: 'textarea' },
  { key: 'notes', label: 'Комментарий', type: 'textarea' },
  { key: 'planned_cost', label: ru.table.plannedCost, type: 'text' },
  { key: 'actual_cost', label: ru.table.actualCost, type: 'text' },
  { key: 'planned_effort', label: ru.table.plannedEffort, type: 'text' },
  { key: 'actual_effort', label: ru.table.actualEffort, type: 'text' },
  { key: 'predecessors', label: ru.table.predecessors, type: 'text' },
]

/** Always visible in adaptive mode (generic projects). */
export const PINNED_KEYS_GENERIC = new Set([
  'status',
  'name',
  'assignee',
  'start_date',
  'end_date',
  'indicative_start',
  'indicative_end',
  'completion_pct',
])

/** Always visible in adaptive mode (DataMarts-style projects). */
export const PINNED_KEYS_DATAMARTS = new Set([
  'status',
  'category_id',
  'name',
  'data_source',
  'subproduct',
  'assignee',
  'start_date',
  'end_date',
  'indicative_start',
  'indicative_end',
  'completion_pct',
])

export function isDatamartsProject(project: ProjectDetail, tasks: Task[]): boolean {
  if (project.name.toLowerCase().includes('витрин')) return true
  return tasks.some((t) => Boolean(t.data_source || t.component_id || t.subproduct))
}

function pinnedKeysForProject(project: ProjectDetail, tasks: Task[]): Set<string> {
  return isDatamartsProject(project, tasks) ? PINNED_KEYS_DATAMARTS : PINNED_KEYS_GENERIC
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function taskHasBuiltinValue(task: Task, key: string): boolean {
  if (key === 'predecessors') return task.predecessors.length > 0
  if (key === 'data_source') return Boolean(task.data_source || task.component_name)
  if (key === 'completion_pct') return task.completion_pct > 0
  const value = task[key as keyof Task]
  return !isEmptyValue(value)
}

function collectCustomKeys(tasks: Task[]): string[] {
  const keys = new Set<string>()
  for (const task of tasks) {
    if (task.custom_fields) {
      for (const [key, value] of Object.entries(task.custom_fields)) {
        if (!isEmptyValue(value)) keys.add(key)
      }
    }
  }
  return [...keys].sort()
}

function labelForCustomKey(key: string, project: ProjectDetail): string {
  const fromSchema = project.table_schema?.find((c) => c.key === key)
  return fromSchema?.label ?? key.replace(/^custom_/, 'Столбец ')
}

function normalizeColumnLabel(col: TableColumnDef): TableColumnDef {
  if (col.key === 'category_id' && col.label === 'БВ') {
    return { ...col, label: 'Область' }
  }
  if (col.key === 'subproduct' && col.label === 'Субпродукт') {
    return { ...col, label: 'Витрина' }
  }
  return col
}

export function resolveTableColumns(project: ProjectDetail, tasks: Task[]): TableColumnDef[] {
  if (project.table_schema?.length) {
    return project.table_schema.map((col) =>
      normalizeColumnLabel({
        key: col.key,
        label: col.label,
        type: (col.type as TableColumnType) || 'text',
        source: col.source === 'custom' ? 'custom' : 'builtin',
      })
    )
  }

  const columns: TableColumnDef[] = []
  const pinned = pinnedKeysForProject(project, tasks)
  for (const def of BUILTIN_COLUMN_ORDER) {
    if (pinned.has(def.key) || tasks.some((t) => taskHasBuiltinValue(t, def.key))) {
      columns.push({ key: def.key, label: def.label, type: def.type, source: 'builtin' })
    }
  }

  for (const key of collectCustomKeys(tasks)) {
    columns.push({
      key,
      label: labelForCustomKey(key, project),
      type: 'text',
      source: 'custom',
    })
  }

  if (!columns.some((c) => c.key === 'status')) {
    columns.unshift({ key: 'status', label: 'Статус', type: 'status', source: 'builtin' })
  }
  if (!columns.some((c) => c.key === 'name')) {
    const insertAt = columns[0]?.key === 'status' ? 1 : 0
    columns.splice(insertAt, 0, { key: 'name', label: ru.table.usage, type: 'text', source: 'builtin' })
  }

  return columns
}

export function getTaskCellValue(task: Task, col: TableColumnDef): unknown {
  if (col.source === 'custom') {
    return task.custom_fields?.[col.key] ?? ''
  }
  if (col.key === 'predecessors') {
    return task.predecessors.map((p) => formatPredecessorRef(p)).join(', ')
  }
  return task[col.key as keyof Task]
}

export function formatReadonlyValue(task: Task, col: TableColumnDef): string {
  if (col.key === 'completion_pct') return `${task.completion_pct}%`
  if (col.key === 'category_id') {
    return ''
  }
  const value = getTaskCellValue(task, col)
  if (col.key === 'status' && typeof value === 'string') {
    return STATUS_LABELS[value as TaskStatus] ?? value
  }
  return value == null ? '' : String(value)
}

export { STATUS_LABELS }
