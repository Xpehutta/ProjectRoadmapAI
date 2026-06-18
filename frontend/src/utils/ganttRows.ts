import type { Category, SubStage, Task } from '../types'
import { sortedSubStages } from './subStageDates'
import type { GroupDateRanges } from './taskGroups'

export const GANTT_TASK_ROW_H = 44
export const GANTT_STAGE_ROW_H = 32
export const GANTT_HEADER_H = 48
export const GANTT_STAGE_ROW_BAR_TOP = 11
export const GANTT_STAGE_BAR_H = 10
/** Bar strip offset on a full task row (legacy compact view). */
export const GANTT_TASK_ROW_STAGE_BAR_TOP = 28

export type GanttRow =
  | {
      kind: 'lane'
      laneLabel: string
      groupKey: string
      groupColor?: string
      taskCount?: number
      groupDateRanges?: GroupDateRanges
    }
  | {
      kind: 'task'
      task: Task
      category?: Category
    }
  | {
      kind: 'stage'
      task: Task
      stage: SubStage
      stageIndex: number
      category?: Category
    }

export interface GanttRowLayout {
  y: number
  h: number
  row: GanttRow
  index: number
}

export function taskHasGanttStages(task: Task): boolean {
  return (task.sub_stages?.length ?? 0) > 0
}

export function computeGanttRowLayouts(
  rows: GanttRow[],
  headerH = GANTT_HEADER_H
): GanttRowLayout[] {
  let y = headerH
  return rows.map((row, index) => {
    const h = row.kind === 'stage' ? GANTT_STAGE_ROW_H : GANTT_TASK_ROW_H
    const layout = { y, h, row, index }
    y += h
    return layout
  })
}

export function chartHeightFromLayouts(layouts: GanttRowLayout[], padding = 20): number {
  if (!layouts.length) return GANTT_HEADER_H + padding
  const last = layouts[layouts.length - 1]
  return last.y + last.h + padding
}

export function buildGanttRows(input: {
  tasks: Task[]
  categories: Category[]
  groupingMode: 'color' | 'swimlane'
  collapsedGroupKeys: string[]
  expandedTaskIds: number[]
  buildGroups: (
    tasks: Task[],
    categories: Category[],
    mode: 'color' | 'swimlane'
  ) => {
    key: string
    label: string
    color?: string
    tasks: Task[]
  }[]
  getGroupDateRanges?: (tasks: Task[]) => GroupDateRanges
}): GanttRow[] {
  const catMap = new Map(input.categories.map((c) => [c.id, c]))
  const expanded = new Set(input.expandedTaskIds)
  const groups = input.buildGroups(input.tasks, input.categories, input.groupingMode).filter(
    (g) => g.tasks.length > 0
  )

  const rows: GanttRow[] = []

  for (const g of groups) {
    if (input.groupingMode === 'swimlane') {
      rows.push({
        kind: 'lane',
        laneLabel: g.label,
        groupKey: g.key,
        groupColor: g.color,
        taskCount: g.tasks.length,
        groupDateRanges: input.getGroupDateRanges?.(g.tasks),
      })
      if (input.collapsedGroupKeys.includes(g.key)) continue
    }

    for (const task of g.tasks) {
      rows.push({
        kind: 'task',
        task,
        category: task.category_id ? catMap.get(task.category_id) : undefined,
      })

      if (expanded.has(task.id)) {
        for (const [stageIndex, stage] of sortedSubStages(task.sub_stages ?? []).entries()) {
          rows.push({
            kind: 'stage',
            task,
            stage,
            stageIndex,
            category: task.category_id ? catMap.get(task.category_id) : undefined,
          })
        }
      }
    }
  }

  return rows
}
