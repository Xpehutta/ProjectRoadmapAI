import type { SavedStageDateShift } from '../stores/savedDateShiftsStore'
import { daysBetween, getShiftArrowSegments, parseDate } from './dateShift'

export function savedStageShiftToBarShift(saved: SavedStageDateShift) {
  const origStart = parseDate(saved.origStart) ?? parseDate(saved.origEnd)
  const origEnd = parseDate(saved.origEnd) ?? parseDate(saved.origStart)
  const curStart = parseDate(saved.curStart) ?? parseDate(saved.curEnd)
  const curEnd = parseDate(saved.curEnd) ?? parseDate(saved.curStart)
  if (!origStart || !origEnd || !curStart || !curEnd) return null

  const startDelta = daysBetween(origStart, curStart)
  const endDelta = daysBetween(origEnd, curEnd)
  if (startDelta === 0 && endDelta === 0) return null

  const segments = getShiftArrowSegments({
    origStart,
    origEnd,
    curStart,
    curEnd,
    startDelta,
    endDelta,
  })
  if (!segments.length) return null

  return {
    stageId: saved.stageId,
    stageName: saved.stageName,
    origStart,
    origEnd,
    curStart,
    curEnd,
    startDelta,
    endDelta,
    segments,
    comment: saved.shiftComment,
  }
}
