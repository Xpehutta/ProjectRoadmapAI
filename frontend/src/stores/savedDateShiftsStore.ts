import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PendingMilestoneDate, PendingTaskChange } from './pendingChangesStore'
import { fmtDate, getTaskDateShiftFromPendingChange } from '../utils/dateShift'

export interface SavedTaskDateShift {
  taskId: number
  origStart: string
  origEnd: string
  curStart: string
  curEnd: string
  shiftComment?: string
}

export interface SavedStageDateShift {
  taskId: number
  stageId: number
  stageName: string
  origStart: string
  origEnd: string
  curStart: string
  curEnd: string
  shiftComment?: string
}

export interface SavedMilestoneDateShift {
  milestoneId: number
  original_date: string
  date: string
  shiftComment?: string
}

interface SavedDateShiftsState {
  taskShifts: Record<number, SavedTaskDateShift[]>
  stageShifts: Record<number, SavedStageDateShift[]>
  milestoneShifts: Record<number, SavedMilestoneDateShift[]>
  recordTaskFromPending: (change: PendingTaskChange) => void
  recordIndicativeShift: (entry: SavedTaskDateShift) => void
  recordStageShift: (entry: SavedStageDateShift) => void
  recordMilestoneFromPending: (change: PendingMilestoneDate) => void
  clearStageShift: (taskId: number, stageId: number) => void
  pruneStageShiftsForTask: (taskId: number, existingStageIds: number[]) => void
  clearTaskDateShifts: (taskId: number) => void
  removeIndicativeShiftTransition: (
    taskId: number,
    orig: { start: string | null; end: string | null },
    cur: { start: string | null; end: string | null }
  ) => void
  clearTaskShifts: (taskId: number) => void
}

export const useSavedDateShiftsStore = create<SavedDateShiftsState>()(
  persist(
    (set) => ({
      taskShifts: {},
      stageShifts: {},
      milestoneShifts: {},

      recordTaskFromPending: (change) =>
        set((s) => {
          const shift = getTaskDateShiftFromPendingChange(change)
          if (!shift) return s
          const entry: SavedTaskDateShift = {
            taskId: change.taskId,
            origStart: fmtDate(shift.origStart),
            origEnd: fmtDate(shift.origEnd),
            curStart: fmtDate(shift.curStart),
            curEnd: fmtDate(shift.curEnd),
            shiftComment: change.shiftComment?.trim() || undefined,
          }
          const prev = s.taskShifts[change.taskId] ?? []
          return {
            taskShifts: {
              ...s.taskShifts,
              [change.taskId]: [...prev, entry],
            },
          }
        }),

      recordIndicativeShift: (entry) =>
        set((s) => {
          const prev = s.taskShifts[entry.taskId] ?? []
          return {
            taskShifts: {
              ...s.taskShifts,
              [entry.taskId]: [...prev, entry],
            },
          }
        }),

      recordStageShift: (entry) =>
        set((s) => {
          const prev = s.stageShifts[entry.taskId] ?? []
          return {
            stageShifts: {
              ...s.stageShifts,
              [entry.taskId]: [...prev.filter((e) => e.stageId !== entry.stageId), entry],
            },
          }
        }),

      recordMilestoneFromPending: (change) =>
        set((s) => {
          if (change.date === change.original_date) return s
          const entry: SavedMilestoneDateShift = {
            milestoneId: change.milestoneId,
            original_date: change.original_date,
            date: change.date,
            shiftComment: change.shiftComment?.trim() || undefined,
          }
          const prev = s.milestoneShifts[change.milestoneId] ?? []
          return {
            milestoneShifts: {
              ...s.milestoneShifts,
              [change.milestoneId]: [...prev, entry],
            },
          }
        }),

      clearStageShift: (taskId, stageId) =>
        set((s) => {
          const prev = s.stageShifts[taskId]
          if (!prev?.length) return s
          const next = prev.filter((e) => e.stageId !== stageId)
          if (next.length === prev.length) return s
          const stageShifts = { ...s.stageShifts }
          if (next.length) stageShifts[taskId] = next
          else delete stageShifts[taskId]
          return { ...s, stageShifts }
        }),

      pruneStageShiftsForTask: (taskId, existingStageIds) =>
        set((s) => {
          const prev = s.stageShifts[taskId]
          if (!prev?.length) return s
          const allowed = new Set(existingStageIds)
          const next = prev.filter((e) => allowed.has(e.stageId))
          if (next.length === prev.length) return s
          const stageShifts = { ...s.stageShifts }
          if (next.length) stageShifts[taskId] = next
          else delete stageShifts[taskId]
          return { ...s, stageShifts }
        }),

      clearTaskDateShifts: (taskId) =>
        set((s) => {
          if (!s.taskShifts[taskId]?.length) return s
          const taskShifts = { ...s.taskShifts }
          delete taskShifts[taskId]
          return { ...s, taskShifts }
        }),

      removeIndicativeShiftTransition: (taskId, orig, cur) =>
        set((s) => {
          if (!orig.start || !orig.end || !cur.start || !cur.end) return s
          const prev = s.taskShifts[taskId]
          if (!prev?.length) return s
          const next = prev.filter(
            (e) =>
              !(
                e.origStart === orig.start &&
                e.origEnd === orig.end &&
                e.curStart === cur.start &&
                e.curEnd === cur.end
              )
          )
          if (next.length === prev.length) return s
          const taskShifts = { ...s.taskShifts }
          if (next.length) taskShifts[taskId] = next
          else delete taskShifts[taskId]
          return { ...s, taskShifts }
        }),

      clearTaskShifts: (taskId) =>
        set((s) => {
          const nextTask = { ...s.taskShifts }
          const nextStage = { ...s.stageShifts }
          let changed = false
          if (nextTask[taskId]) {
            delete nextTask[taskId]
            changed = true
          }
          if (nextStage[taskId]) {
            delete nextStage[taskId]
            changed = true
          }
          if (!changed) return s
          return { taskShifts: nextTask, stageShifts: nextStage }
        }),
    }),
    {
      name: 'roadmap-saved-date-shifts',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        taskShifts: state.taskShifts,
        stageShifts: state.stageShifts,
        milestoneShifts: state.milestoneShifts,
      }),
    }
  )
)
