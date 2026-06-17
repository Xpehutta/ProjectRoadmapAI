import type { QueryClient } from '@tanstack/react-query'
import type { ProjectDetail } from '../types'
import { usePendingChangesStore } from '../stores/pendingChangesStore'

/** Refetch project and align pending-change versions after immediate sub-stage writes. */
export async function refreshProjectAfterSubStageChange(
  qc: QueryClient,
  projectId: number
): Promise<void> {
  await qc.refetchQueries({ queryKey: ['project', projectId] })
  const project = qc.getQueryData<ProjectDetail>(['project', projectId])
  if (project) {
    usePendingChangesStore.getState().syncVersionsFromTasks(project.tasks)
  }
}
