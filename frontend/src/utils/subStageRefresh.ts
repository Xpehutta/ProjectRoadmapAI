import type { QueryClient } from '@tanstack/react-query'
import type { ProjectDetail, SubStage, Task } from '../types'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { valuesEqual } from './taskPending'

const SERVER_MANAGED_STAGE_FIELDS = [
  'start_date',
  'end_date',
  'duration_days',
  'completion_pct',
  'status',
  'indicative_start',
  'indicative_end',
] as const

/** Apply task payload from internal-links API (sub_stages + internal_stage_links). */
export function applyTaskInternalLinksUpdate(
  qc: QueryClient,
  projectId: number,
  updated: Task
): void {
  qc.setQueryData<ProjectDetail>(['project', projectId], (old) => {
    if (!old) return old
    return {
      ...old,
      tasks: old.tasks.map((t) =>
        t.id === updated.id
          ? {
              ...t,
              internal_stage_links: updated.internal_stage_links,
              sub_stages: updated.sub_stages,
            }
          : t
      ),
    }
  })
}

export function patchSubStageInProjectCache(
  qc: QueryClient,
  projectId: number,
  stageId: number,
  patch: Partial<SubStage>
): void {
  qc.setQueryData<ProjectDetail>(['project', projectId], (old) => {
    if (!old) return old
    return {
      ...old,
      tasks: old.tasks.map((t) => {
        if (!t.sub_stages?.some((s) => s.id === stageId)) return t
        return {
          ...t,
          sub_stages: t.sub_stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)),
        }
      }),
    }
  })
}

/** Drop a sub-stage from the project cache (all tasks sharing component stages). */
export function removeSubStageFromProjectCache(
  qc: QueryClient,
  projectId: number,
  stageId: number
): void {
  qc.setQueryData<ProjectDetail>(['project', projectId], (old) => {
    if (!old) return old
    return {
      ...old,
      tasks: old.tasks.map((t) => {
        if (!t.sub_stages?.some((s) => s.id === stageId)) return t
        return {
          ...t,
          sub_stages: t.sub_stages.filter((s) => s.id !== stageId),
        }
      }),
    }
  })
}

/** Clear staged server-managed fields that only mirrored pre-change server state. */
export function reconcilePendingAfterSubStageChange(
  beforeById: Map<number, Task>,
  afterTasks: Task[]
): void {
  const { taskChanges, stageTaskChange } = usePendingChangesStore.getState()
  for (const fresh of afterTasks) {
    const change = taskChanges[fresh.id]
    if (!change) continue
    const before = beforeById.get(fresh.id)
    const updates: Record<string, unknown> = {}
    for (const field of SERVER_MANAGED_STAGE_FIELDS) {
      if (!(field in change.patch)) continue
      const patchVal = change.patch[field]
      const beforeVal = before?.[field]
      if (before && valuesEqual(patchVal, beforeVal)) {
        updates[field] = fresh[field]
      }
    }
    if (Object.keys(updates).length > 0) {
      stageTaskChange(fresh, updates)
    }
  }
}

/** Refetch project and align pending-change versions after immediate sub-stage writes. */
export async function refreshProjectAfterSubStageChange(
  qc: QueryClient,
  projectId: number,
  options?: { beforeById?: Map<number, Task> }
): Promise<void> {
  await qc.refetchQueries({ queryKey: ['project', projectId] })
  const project = qc.getQueryData<ProjectDetail>(['project', projectId])
  if (project) {
    usePendingChangesStore.getState().syncVersionsFromTasks(project.tasks)
    if (options?.beforeById) {
      reconcilePendingAfterSubStageChange(options.beforeById, project.tasks)
    }
  }
}
