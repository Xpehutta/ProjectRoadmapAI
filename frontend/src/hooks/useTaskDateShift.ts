import { useMemo } from 'react'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import {
  useSavedDateShiftsStore,
  type SavedTaskDateShift,
} from '../stores/savedDateShiftsStore'
import type { Task } from '../types'
import {
  getTaskDateShift,
  savedTaskShiftToDateShift,
  type TaskDateShift,
} from '../utils/dateShift'

export interface TaskDateShiftEntry {
  shift: TaskDateShift
  saved: boolean
  comment?: string
  onCommentChange?: (comment: string) => void
}

const EMPTY_SAVED_SHIFTS: SavedTaskDateShift[] = []

export function useTaskDateShifts(task: Task): TaskDateShiftEntry[] {
  const change = usePendingChangesStore((s) => s.taskChanges[task.id])
  const setTaskShiftComment = usePendingChangesStore((s) => s.setTaskShiftComment)
  const savedList =
    useSavedDateShiftsStore((s) => s.taskShifts[task.id]) ?? EMPTY_SAVED_SHIFTS
  return useMemo(() => {
    const entries: TaskDateShiftEntry[] = []
    for (const saved of savedList) {
      const shift = savedTaskShiftToDateShift(saved)
      if (shift) {
        entries.push({
          shift,
          saved: true,
          comment: saved.shiftComment,
        })
      }
    }
    const pending = getTaskDateShift(task, change)
    if (pending) {
      entries.push({
        shift: pending,
        saved: false,
        comment: change?.shiftComment,
        onCommentChange: (c) => setTaskShiftComment(task.id, c),
      })
    }
    return entries
  }, [task, change, savedList, setTaskShiftComment])
}

/** @deprecated use useTaskDateShifts */
export function useTaskDateShift(task: Task): { shift: TaskDateShift | null; isSaved: boolean } {
  const entries = useTaskDateShifts(task)
  const last = entries[entries.length - 1]
  return { shift: last?.shift ?? null, isSaved: last?.saved ?? false }
}
