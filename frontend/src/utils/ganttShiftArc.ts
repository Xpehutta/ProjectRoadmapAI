export type ShiftArcPosition = 'above' | 'below'

export interface ShiftArcGeometry {
  path: string
  labelX: number
  labelY: number
  hitX: number
  hitY: number
  hitW: number
  hitH: number
  popoverY: number
}

/** Quadratic arc from origin anchor to new anchor, bulging above or below the bar. */
export function buildShiftArcGeometry(
  fromX: number,
  toX: number,
  barTop: number,
  barBottom: number,
  position: ShiftArcPosition,
  layer: number
): ShiftArcGeometry | null {
  if (Math.abs(toX - fromX) < 2) return null

  const midX = (fromX + toX) / 2
  const bulge = 12 + layer * 14
  const attachY = position === 'above' ? barTop : barBottom
  const yEnd = position === 'above' ? attachY - 2 : attachY + 2
  const controlY = position === 'above' ? attachY - 2 - bulge : attachY + 2 + bulge

  const path = `M ${fromX} ${yEnd} Q ${midX} ${controlY} ${toX} ${yEnd}`

  const labelX = midX
  const labelY = position === 'above' ? controlY - 6 : controlY + 14

  const hitX = Math.min(fromX, toX, midX) - 12
  const hitY = Math.min(yEnd, controlY) - 14
  const hitW = Math.abs(toX - fromX) + 24
  const hitH = Math.abs(controlY - yEnd) + 28

  const popoverY = position === 'above' ? controlY - 8 : controlY + 18

  return { path, labelX, labelY, hitX, hitY, hitW, hitH, popoverY }
}

export function shiftArcPositionForEdge(
  edge: 'start' | 'end',
  variant: 'task' | 'stage' | 'milestone'
): ShiftArcPosition {
  if (variant === 'stage') return 'below'
  if (variant === 'milestone') return 'above'
  return edge === 'start' ? 'above' : 'below'
}

export function shiftArcLayer(
  shiftIndex: number,
  segmentIndex: number,
  edge: 'start' | 'end',
  variant: 'task' | 'stage' | 'milestone'
): number {
  if (variant === 'stage') {
    return shiftIndex * 2 + (edge === 'end' ? 1 : 0) + segmentIndex
  }
  return shiftIndex + segmentIndex
}
