import type { Category, GroupingMode, Task } from '../types'
import { fmtDate, getEffectiveTaskDates, parseDate } from './dateShift'
import { ru } from '../locale/ru'

export interface TaskGroup {
  key: string
  categoryId: number | null
  label: string
  color?: string
  tasks: Task[]
}

export interface GroupDateRange {
  start: Date
  end: Date
}

export interface GroupDateRanges {
  actual: GroupDateRange | null
  indicative: GroupDateRange | null
}

export function getGroupDateRange(
  tasks: Task[],
  resolveDates?: (task: Task) => { start: Date | null; end: Date | null }
): GroupDateRange | null {
  const getDates =
    resolveDates ?? ((task) => getEffectiveTaskDates(task))

  let minStart: Date | null = null
  let maxEnd: Date | null = null

  for (const task of tasks) {
    const { start, end } = getDates(task)
    if (start && (!minStart || start < minStart)) minStart = start
    if (end && (!maxEnd || end > maxEnd)) maxEnd = end
  }

  if (!minStart || !maxEnd) return null
  return { start: minStart, end: maxEnd }
}

export function formatGroupDateRange(range: GroupDateRange | null): string {
  if (!range) return ru.groups.noDates
  return `${fmtDate(range.start)} – ${fmtDate(range.end)}`
}

export function getGroupDateRangesFromTasks(tasks: Task[]): GroupDateRanges {
  return {
    actual: getGroupDateRange(tasks, (task) => ({
      start: parseDate(task.start_date),
      end: parseDate(task.end_date),
    })),
    indicative: getGroupDateRange(tasks, (task) => ({
      start: parseDate(task.indicative_start),
      end: parseDate(task.indicative_end),
    })),
  }
}

export function formatGroupDateRanges(ranges: GroupDateRanges): string | null {
  const parts: string[] = []
  if (ranges.actual) {
    parts.push(`${ru.groups.actual} ${formatGroupDateRange(ranges.actual)}`)
  }
  if (ranges.indicative) {
    parts.push(`${ru.groups.indicative} ${formatGroupDateRange(ranges.indicative)}`)
  }
  return parts.length ? parts.join(' · ') : null
}

/** @deprecated Use getGroupDateRangesFromTasks */
export function getGroupDateRangeFromTasks(tasks: Task[]): GroupDateRange | null {
  return getGroupDateRangesFromTasks(tasks).actual
}

function sortTasksByName(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.name.localeCompare(b.name))
}

export function buildTaskGroups(
  tasks: Task[],
  categories: Category[],
  groupingMode: GroupingMode
): TaskGroup[] {
  const sortedCategories = [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  )

  if (groupingMode !== 'swimlane') {
    const catName = (id: number | null) =>
      sortedCategories.find((c) => c.id === id)?.name ?? 'Uncategorized'
    const sorted = [...tasks].sort((a, b) => {
      const byCat = catName(a.category_id).localeCompare(catName(b.category_id))
      if (byCat !== 0) return byCat
      return a.name.localeCompare(b.name)
    })
    return [{ key: 'all', categoryId: null, label: ru.groups.allTasks, tasks: sorted }]
  }

  const groups: TaskGroup[] = []
  for (const cat of sortedCategories) {
    const catTasks = sortTasksByName(tasks.filter((t) => t.category_id === cat.id))
    groups.push({
      key: `cat-${cat.id}`,
      categoryId: cat.id,
      label: cat.name,
      color: cat.color,
      tasks: catTasks,
    })
  }

  const uncategorized = sortTasksByName(tasks.filter((t) => !t.category_id))
  if (uncategorized.length) {
    groups.push({
      key: 'uncategorized',
      categoryId: null,
      label: ru.groups.uncategorized,
      color: '#94a3b8',
      tasks: uncategorized,
    })
  }

  return groups
}

export function getTaskCategoryColor(
  task: Task,
  categories: Category[],
  fallback = '#94a3b8'
): string {
  return categories.find((c) => c.id === task.category_id)?.color ?? fallback
}
