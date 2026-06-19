import type { PendingTaskChange } from '../stores/pendingChangesStore'
import type { Task } from '../types'
import { normValue } from './taskPending'

const DAY_MS = 86400000

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  return new Date(s + 'T00:00:00')
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface TaskDateShift {
  origStart: Date
  origEnd: Date
  curStart: Date
  curEnd: Date
  startDelta: number
  endDelta: number
  deltaDays: number
  shiftedRight: boolean
}

export function getEffectiveTaskDates(
  task: Task,
  patch?: Record<string, unknown>
): { start: Date | null; end: Date | null } {
  return {
    start: parseDate((patch?.start_date ?? task.start_date) as string | null),
    end: parseDate((patch?.end_date ?? task.end_date) as string | null),
  }
}

export function getOriginalTaskDates(
  task: Task,
  change?: PendingTaskChange
): { start: Date | null; end: Date | null } {
  if (change?.original) {
    return {
      start: parseDate(change.original.start_date as string | null),
      end: parseDate(change.original.end_date as string | null),
    }
  }
  return getEffectiveTaskDates(task)
}

export function hasTaskDateChange(task: Task, change?: PendingTaskChange): boolean {
  if (!change) return false
  const origStart = normValue(change.original.start_date)
  const origEnd = normValue(change.original.end_date)
  const curStart = normValue(change.patch.start_date ?? task.start_date)
  const curEnd = normValue(change.patch.end_date ?? task.end_date)
  return origStart !== curStart || origEnd !== curEnd
}

export function getTaskDateShift(task: Task, change?: PendingTaskChange): TaskDateShift | null {
  if (!change || !hasTaskDateChange(task, change)) return null

  const original = getOriginalTaskDates(task, change)
  const current = getEffectiveTaskDates(task, change.patch)
  if (!original.start || !original.end || !current.start || !current.end) return null

  const startDelta = daysBetween(original.start, current.start)
  const endDelta = daysBetween(original.end, current.end)
  if (startDelta === 0 && endDelta === 0) return null

  const deltaDays = startDelta !== 0 ? startDelta : endDelta
  return {
    origStart: original.start,
    origEnd: original.end,
    curStart: current.start,
    curEnd: current.end,
    startDelta,
    endDelta,
    deltaDays,
    shiftedRight: deltaDays > 0,
  }
}

export function getTaskDateShiftFromPendingChange(change: PendingTaskChange): TaskDateShift | null {
  const task = {
    id: change.taskId,
    start_date: change.original.start_date as string | null,
    end_date: change.original.end_date as string | null,
  } as Task
  return getTaskDateShift(task, change)
}

export function savedTaskShiftToDateShift(saved: {
  origStart: string
  origEnd: string
  curStart: string
  curEnd: string
}): TaskDateShift | null {
  const origStart = parseDate(saved.origStart)
  const origEnd = parseDate(saved.origEnd)
  const curStart = parseDate(saved.curStart)
  const curEnd = parseDate(saved.curEnd)
  if (!origStart || !origEnd || !curStart || !curEnd) return null

  const startDelta = daysBetween(origStart, curStart)
  const endDelta = daysBetween(origEnd, curEnd)
  if (startDelta === 0 && endDelta === 0) return null

  const deltaDays = startDelta !== 0 ? startDelta : endDelta
  return {
    origStart,
    origEnd,
    curStart,
    curEnd,
    startDelta,
    endDelta,
    deltaDays,
    shiftedRight: deltaDays > 0,
  }
}

/** Hide saved shifts that no longer relate to current task or indicative dates (e.g. after stage delete). */
export function savedTaskShiftStillRelevant(
  task: Pick<Task, 'start_date' | 'end_date' | 'indicative_start' | 'indicative_end'>,
  saved: { origStart: string; origEnd: string; curStart: string; curEnd: string }
): boolean {
  const ranges: [string | null, string | null][] = [
    [task.indicative_start, task.indicative_end],
    [task.start_date, task.end_date],
  ]
  for (const [start, end] of ranges) {
    if (!start || !end) continue
    if (start === saved.curStart && end === saved.curEnd) return true
    if (start === saved.origStart && end === saved.origEnd) return true
  }
  return false
}

export function savedMilestoneShiftToDelta(saved: {
  original_date: string
  date: string
}): { orig: Date; next: Date; deltaDays: number } | null {
  const orig = parseDate(saved.original_date)
  const next = parseDate(saved.date)
  if (!orig || !next) return null
  const deltaDays = daysBetween(orig, next)
  if (deltaDays === 0) return null
  return { orig, next, deltaDays }
}

export interface ShiftArrowSegment {
  edge: 'start' | 'end'
  origPoint: Date
  curPoint: Date
  deltaDays: number
}

/** One or two arrow segments anchored to the bar edges that actually moved. */
export function getShiftArrowSegments(shift: {
  origStart: Date
  origEnd: Date
  curStart: Date
  curEnd: Date
  startDelta: number
  endDelta: number
}): ShiftArrowSegment[] {
  const { startDelta, endDelta } = shift
  if (startDelta === 0 && endDelta === 0) return []

  const segments: ShiftArrowSegment[] = []

  if (startDelta !== 0 && startDelta === endDelta) {
    segments.push({
      edge: 'start',
      origPoint: shift.origStart,
      curPoint: shift.curStart,
      deltaDays: startDelta,
    })
    return segments
  }

  if (startDelta !== 0) {
    segments.push({
      edge: 'start',
      origPoint: shift.origStart,
      curPoint: shift.curStart,
      deltaDays: startDelta,
    })
  }

  if (endDelta !== 0) {
    segments.push({
      edge: 'end',
      origPoint: shift.origEnd,
      curPoint: shift.curEnd,
      deltaDays: endDelta,
    })
  }

  return segments
}

export function shiftArrowLineCoords(
  x1: number,
  x2: number,
  shiftedRight: boolean
): { lineX1: number; lineX2: number } {
  return shiftedRight
    ? { lineX1: Math.min(x1, x2), lineX2: Math.max(x1, x2) }
    : { lineX1: Math.max(x1, x2), lineX2: Math.min(x1, x2) }
}

