import type { Task } from '../types'

export interface ScheduleSegment {
  left: number
  width: number
}

export interface ScheduleBarLayout {
  hasAny: boolean
  actual: ScheduleSegment | null
  indicative: ScheduleSegment | null
}

function parseDate(value: string | null): number | null {
  if (!value) return null
  const time = new Date(value.slice(0, 10)).getTime()
  return Number.isFinite(time) ? time : null
}

function segmentForRange(
  startMs: number,
  endMs: number,
  min: number,
  span: number
): ScheduleSegment {
  const from = Math.min(startMs, endMs)
  const to = Math.max(startMs, endMs)
  return {
    left: ((from - min) / span) * 100,
    width: Math.max(((to - from) / span) * 100, 2),
  }
}

/** Layout for mini schedule bars (actual solid + indicative dashed). */
export function computeScheduleBarLayout(
  task: Task,
  showIndicative: boolean
): ScheduleBarLayout {
  const times: number[] = []
  const add = (value: string | null) => {
    const ms = parseDate(value)
    if (ms != null) times.push(ms)
  }

  add(task.start_date)
  add(task.end_date)
  if (showIndicative) {
    add(task.indicative_start)
    add(task.indicative_end)
  }

  if (!times.length) {
    return { hasAny: false, actual: null, indicative: null }
  }

  const min = Math.min(...times)
  const max = Math.max(...times)
  const span = Math.max(max - min, 86_400_000)

  const actualStart = parseDate(task.start_date)
  const actualEnd = parseDate(task.end_date)
  const indStart = showIndicative ? parseDate(task.indicative_start) : null
  const indEnd = showIndicative ? parseDate(task.indicative_end) : null

  const actual =
    actualStart != null && actualEnd != null
      ? segmentForRange(actualStart, actualEnd, min, span)
      : actualStart != null
        ? segmentForRange(actualStart, actualStart, min, span)
        : null

  const indicative =
    indStart != null && indEnd != null
      ? segmentForRange(indStart, indEnd, min, span)
      : indStart != null
        ? segmentForRange(indStart, indStart, min, span)
        : indEnd != null
          ? segmentForRange(indEnd, indEnd, min, span)
          : null

  return {
    hasAny: Boolean(actual || indicative),
    actual,
    indicative,
  }
}
