import { create } from 'zustand'
import type { Task } from '../types'
import { taskEditSnapshot, valuesEqual } from '../utils/taskPending'

export interface PendingTaskChange {
  taskId: number
  taskName: string
  version: number
  patch: Record<string, unknown>
  original: Record<string, unknown>
  shiftComment?: string
}

export interface PendingMilestoneDate {
  milestoneId: number
  name: string
  date: string
  original_date: string
  shiftComment?: string
}

interface PendingChangesState {
  taskChanges: Record<number, PendingTaskChange>
  milestones: Record<number, PendingMilestoneDate>
  stageTaskChange: (task: Task, fields: Record<string, unknown>) => void
  stageTaskDates: (
    task: Task,
    start_date: string,
    end_date: string
  ) => void
  stageMilestone: (change: PendingMilestoneDate) => void
  setTaskShiftComment: (taskId: number, comment: string) => void
  setMilestoneShiftComment: (milestoneId: number, comment: string) => void
  getTaskPatch: (taskId: number) => Record<string, unknown> | undefined
  hasTaskPending: (taskId: number) => boolean
  clearAll: () => void
  clearTask: (taskId: number) => void
  hasPending: () => boolean
  count: () => number
}

export const usePendingChangesStore = create<PendingChangesState>((set, get) => ({
  taskChanges: {},
  milestones: {},

  stageTaskChange: (task, fields) =>
    set((s) => {
      const prev = s.taskChanges[task.id]
      const original = prev?.original ?? taskEditSnapshot(task)
      const merged = { ...(prev?.patch ?? {}), ...fields }
      const cleaned: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(merged)) {
        if (!valuesEqual(value, original[key])) {
          cleaned[key] = value
        }
      }
      const next = { ...s.taskChanges }
      if (Object.keys(cleaned).length === 0) {
        delete next[task.id]
      } else {
        next[task.id] = {
          taskId: task.id,
          taskName: task.name,
          version: task.version,
          patch: cleaned,
          original,
          shiftComment: prev?.shiftComment,
        }
      }
      return { taskChanges: next }
    }),

  stageTaskDates: (task, start_date, end_date) => {
    get().stageTaskChange(task, { start_date, end_date })
  },

  stageMilestone: (change) =>
    set((s) => {
      const prev = s.milestones[change.milestoneId]
      const next = { ...s.milestones }
      if (change.date === change.original_date) {
        delete next[change.milestoneId]
      } else {
        next[change.milestoneId] = {
          ...change,
          shiftComment: change.shiftComment ?? prev?.shiftComment,
        }
      }
      return { milestones: next }
    }),

  setTaskShiftComment: (taskId, comment) =>
    set((s) => {
      const change = s.taskChanges[taskId]
      if (!change) return s
      return {
        taskChanges: {
          ...s.taskChanges,
          [taskId]: { ...change, shiftComment: comment },
        },
      }
    }),

  setMilestoneShiftComment: (milestoneId, comment) =>
    set((s) => {
      const change = s.milestones[milestoneId]
      if (!change) return s
      return {
        milestones: {
          ...s.milestones,
          [milestoneId]: { ...change, shiftComment: comment },
        },
      }
    }),

  getTaskPatch: (taskId) => get().taskChanges[taskId]?.patch,

  hasTaskPending: (taskId) => Boolean(get().taskChanges[taskId]),

  clearAll: () => set({ taskChanges: {}, milestones: {} }),

  clearTask: (taskId) =>
    set((s) => {
      if (!s.taskChanges[taskId]) return s
      const next = { ...s.taskChanges }
      delete next[taskId]
      return { taskChanges: next }
    }),

  hasPending: () => {
    const s = get()
    return Object.keys(s.taskChanges).length > 0 || Object.keys(s.milestones).length > 0
  },

  count: () => {
    const s = get()
    return Object.keys(s.taskChanges).length + Object.keys(s.milestones).length
  },
}))
