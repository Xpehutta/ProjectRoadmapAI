import { useMemo } from 'react'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import type { Task, TaskStatus } from '../types'
import {
  applyPendingToTask,
  buildComponentPendingPatches,
  isTaskDisplayPending,
  resolveEffectivePatch,
} from '../utils/taskPending'
import {
  actualDatesFromCompletedStages,
  completionPctFromStages,
  durationDaysFromStageRange,
  indicativeDatesFromStages,
} from '../utils/stageIndicative'

function withActualFromStages(task: Task, patch?: Record<string, unknown>): Task {
  if (!task.sub_stages?.length) return task
  const hasActualPending =
    patch &&
    ('start_date' in patch || 'end_date' in patch || 'duration_days' in patch)
  if (hasActualPending) return task
  const { start, end } = actualDatesFromCompletedStages(task.sub_stages)
  return {
    ...task,
    start_date: start,
    end_date: end,
    duration_days: durationDaysFromStageRange(start, end),
  }
}

function withCompletionFromStages(task: Task, patch?: Record<string, unknown>): Task {
  const hasCompletionPending = patch && 'completion_pct' in patch
  if (hasCompletionPending) return task
  if (!task.sub_stages?.length) {
    return task.completion_pct === 0 ? task : { ...task, completion_pct: 0 }
  }
  const completion_pct = completionPctFromStages(task.sub_stages)
  return task.completion_pct === completion_pct ? task : { ...task, completion_pct }
}

function withStatusFromStages(task: Task, patch?: Record<string, unknown>): Task {
  if (patch && 'status' in patch) return task
  if (!task.sub_stages?.length) {
    if (task.status === 'done') {
      return { ...task, status: 'in_progress' }
    }
    return task
  }
  const completion_pct = completionPctFromStages(task.sub_stages)
  if (completion_pct >= 100 && task.status !== 'done') {
    return { ...task, status: 'done' }
  }
  if (completion_pct < 100 && task.status === 'done') {
    return { ...task, status: 'in_progress' }
  }
  return task
}

function withIndicativeFromStages(task: Task, patch?: Record<string, unknown>): Task {
  if (!task.sub_stages?.length) return task
  const hasIndicativePending =
    patch &&
    ('indicative_start' in patch || 'indicative_end' in patch)
  if (hasIndicativePending) return task
  const { start, end } = indicativeDatesFromStages(task.sub_stages)
  return { ...task, indicative_start: start, indicative_end: end }
}

export function useEffectiveTasks(tasks: Task[]): Task[] {
  const taskChanges = usePendingChangesStore((s) => s.taskChanges)
  return useMemo(() => {
    const componentPatches = buildComponentPendingPatches(tasks, taskChanges)
    return tasks.map((t) => {
      const patch = resolveEffectivePatch(t, taskChanges, componentPatches)
      const effective = applyPendingToTask(t, patch)
      const withStages = withActualFromStages(effective, patch)
      const withCompletion = withCompletionFromStages(withStages, patch)
      const withStatus = withStatusFromStages(withCompletion, patch)
      return withIndicativeFromStages(withStatus, patch)
    })
  }, [tasks, taskChanges])
}

export function useEffectiveTask(tasks: Task[], taskId: number): Task {
  const effectiveTasks = useEffectiveTasks(tasks)
  return useMemo(() => {
    return (
      effectiveTasks.find((t) => t.id === taskId) ??
      tasks.find((t) => t.id === taskId) ?? {
        id: taskId,
        name: '',
      } as Task
    )
  }, [effectiveTasks, tasks, taskId])
}

export function useEffectiveStatus(task: Task): TaskStatus {
  const patch = usePendingChangesStore((s) => s.taskChanges[task.id]?.patch)
  return (patch?.status as TaskStatus) ?? task.status
}

export function useHasAnyPending(): boolean {
  return usePendingChangesStore(
    (s) => Object.keys(s.taskChanges).length + Object.keys(s.milestones).length > 0
  )
}

export function usePendingTaskIds(tasks: Task[]): Set<number> {
  const taskChanges = usePendingChangesStore((s) => s.taskChanges)
  const effectiveTasks = useEffectiveTasks(tasks)
  return useMemo(() => {
    const baseById = new Map(tasks.map((t) => [t.id, t]))
    const ids = new Set<number>()
    for (const effective of effectiveTasks) {
      const base = baseById.get(effective.id) ?? effective
      if (isTaskDisplayPending(effective.id, base, effective, taskChanges)) {
        ids.add(effective.id)
      }
    }
    return ids
  }, [tasks, effectiveTasks, taskChanges])
}
