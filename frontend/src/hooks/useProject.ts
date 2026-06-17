import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useSavedDateShiftsStore } from '../stores/savedDateShiftsStore'
import { useUIStore } from '../stores/uiStore'
import type { ProjectDetail, Task } from '../types'

const PROJECT_ID_KEY = 'roadmap-selected-project-id'

export function getStoredProjectId(): number | null {
  const raw = localStorage.getItem(PROJECT_ID_KEY)
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.listProjects(),
  })
}

export function useProject(projectId: number) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const data = await api.getProject(projectId)
      return {
        ...data,
        releases: data.releases ?? [],
        goals: data.goals ?? [],
      }
    },
    enabled: projectId > 0,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string | null }) => api.createProject(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useImportProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      file,
      name,
      description,
    }: {
      file: File
      name?: string
      description?: string
    }) => api.importProject(file, name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateTask(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: number; body: Record<string, unknown> }) =>
      api.updateTask(taskId, body),
    onSuccess: (data) => {
      qc.setQueryData<ProjectDetail>(['project', projectId], (old) => {
        if (!old) return old
        const tasks = old.tasks.map((t) => {
          if (t.id === data.task.id) return data.task
          const affected = data.affected_tasks.find((a) => a.id === t.id)
          return affected || t
        })
        for (const a of data.affected_tasks) {
          if (!tasks.find((t) => t.id === a.id)) tasks.push(a)
        }
        return { ...old, tasks }
      })
    },
  })
}

export function useCreateTask(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.createTask(projectId, body),
    onSuccess: (task: Task) => {
      qc.setQueryData<ProjectDetail>(['project', projectId], (old) => {
        if (!old) return old
        if (old.tasks.some((t) => t.id === task.id)) return old
        return { ...old, tasks: [...old.tasks, task] }
      })
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteTask(projectId: number) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (taskId: number) => api.deleteTask(taskId),
    onSuccess: (_data, taskId) => {
      qc.setQueryData<ProjectDetail>(['project', projectId], (old) => {
        if (!old) return old
        return {
          ...old,
          tasks: old.tasks.filter((t) => t.id !== taskId),
          dependencies: old.dependencies.filter(
            (d) => d.predecessor_id !== taskId && d.successor_id !== taskId
          ),
          components: old.components.map((c) => {
            const usages = c.usages.filter((u) => u.id !== taskId)
            if (usages.length === c.usages.length) return c
            return { ...c, usages, usage_count: usages.length }
          }),
        }
      })

      usePendingChangesStore.getState().clearTask(taskId)
      useSavedDateShiftsStore.getState().clearTaskShifts(taskId)

      if (useUIStore.getState().selectedTaskId === taskId) {
        useUIStore.getState().setSelectedTaskId(null)
      }

      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.removeQueries({ queryKey: ['comments', taskId] })
      void qc.removeQueries({ queryKey: ['history', taskId] })
    },
  })
}
