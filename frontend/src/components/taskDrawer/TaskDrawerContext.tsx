import { createContext, useContext, type ReactNode } from 'react'
import type { ProjectDetail, Task } from '../../types'
import { useTaskDrawer, type TaskDrawerState } from './useTaskDrawer'

const TaskDrawerContext = createContext<TaskDrawerState | null>(null)

export function TaskDrawerProvider({
  project,
  task,
  children,
}: {
  project: ProjectDetail
  task: Task
  children: ReactNode
}) {
  const value = useTaskDrawer(project, task)
  return <TaskDrawerContext.Provider value={value}>{children}</TaskDrawerContext.Provider>
}

export function useTaskDrawerContext(): TaskDrawerState {
  const ctx = useContext(TaskDrawerContext)
  if (!ctx) {
    throw new Error('useTaskDrawerContext must be used within TaskDrawerProvider')
  }
  return ctx
}
