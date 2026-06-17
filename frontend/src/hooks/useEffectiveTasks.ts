import { useMemo } from 'react'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import type { Task, TaskStatus } from '../types'
import {
  applyPendingToTask,
  buildComponentPendingPatches,
  isTaskDisplayPending,
  resolveEffectivePatch,
} from '../utils/taskPending'

export function useEffectiveTasks(tasks: Task[]): Task[] {
  const taskChanges = usePendingChangesStore((s) => s.taskChanges)
  return useMemo(() => {
    const componentPatches = buildComponentPendingPatches(tasks, taskChanges)
    return tasks.map((t) =>
      applyPendingToTask(t, resolveEffectivePatch(t, taskChanges, componentPatches))
    )
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
