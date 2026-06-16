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

export interface SavedMilestoneDateShift {
  milestoneId: number
  original_date: string
  date: string
  shiftComment?: string
}

interface SavedDateShiftsState {
  taskShifts: Record<number, SavedTaskDateShift[]>
  milestoneShifts: Record<number, SavedMilestoneDateShift[]>
  recordTaskFromPending: (change: PendingTaskChange) => void
  recordMilestoneFromPending: (change: PendingMilestoneDate) => void
  clearTaskShifts: (taskId: number) => void
}

export const useSavedDateShiftsStore = create<SavedDateShiftsState>()(
  persist(
    (set) => ({
      taskShifts: {},
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

      clearTaskShifts: (taskId) =>
        set((s) => {
          if (!s.taskShifts[taskId]) return s
          const next = { ...s.taskShifts }
          delete next[taskId]
          return { taskShifts: next }
        }),
    }),
    {
      name: 'roadmap-saved-date-shifts',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        taskShifts: state.taskShifts,
        milestoneShifts: state.milestoneShifts,
      }),
    }
  )
)
