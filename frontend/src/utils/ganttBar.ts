import { daysBetween } from './dateShift'

/** Inclusive calendar span (same day => 1). Matches backend duration_days. */
export function inclusiveDaysBetween(start: Date, end: Date): number {
  const diff = daysBetween(start, end)
  return (diff >= 0 ? diff : -diff) + 1
}

export function normalizedDateRange(start: Date, end: Date): { start: Date; end: Date } {
  if (start.getTime() <= end.getTime()) return { start, end }
  return { start: end, end: start }
}

export function ganttBarWidthPx(
  start: Date,
  end: Date,
  dayWidth: number,
  minWidth = 4
): number {
  const { start: s, end: e } = normalizedDateRange(start, end)
  return Math.max(inclusiveDaysBetween(s, e) * dayWidth, minWidth)
}

/** Right edge of an inclusive date bar on the Gantt chart. */
export function ganttBarEndX(
  start: Date,
  end: Date,
  dayWidth: number,
  xForDate: (d: Date) => number,
  minWidth = 4
): number {
  const { start: s, end: e } = normalizedDateRange(start, end)
  return xForDate(s) + ganttBarWidthPx(s, e, dayWidth, minWidth)
}
