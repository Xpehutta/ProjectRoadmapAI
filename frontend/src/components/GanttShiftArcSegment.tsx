import { ShiftCommentPopover } from './ShiftCommentPopover'
import { buildShiftArcGeometry, type ShiftArcPosition } from '../utils/ganttShiftArc'

interface Props {
  fromX: number
  toX: number
  barTop: number
  barBottom: number
  position: ShiftArcPosition
  layer: number
  color: string
  markerId: string
  strokeWidth: number
  deltaDays: number
  saved?: boolean
  hasComment: boolean
  commentSnippet?: string
  showShiftComments: boolean
  isOpen: boolean
  onToggleComment: () => void
  popoverLabel: string
  comment: string
  onCommentChange?: (comment: string) => void
  onClosePopover: () => void
  popoverX: number
  className?: string
}

export function GanttShiftArcSegment({
  fromX,
  toX,
  barTop,
  barBottom,
  position,
  layer,
  color,
  markerId,
  strokeWidth,
  deltaDays,
  saved,
  hasComment,
  commentSnippet,
  showShiftComments,
  isOpen,
  onToggleComment,
  popoverLabel,
  comment,
  onCommentChange,
  onClosePopover,
  popoverX,
  className,
}: Props) {
  const arc = buildShiftArcGeometry(fromX, toX, barTop, barBottom, position, layer)
  if (!arc) return null

  return (
    <g className={className ?? 'shift-arrow-gantt'} opacity={saved ? 0.75 : 1}>
      <path
        d={arc.path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        markerEnd={`url(#${markerId})`}
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
      <rect
        x={arc.hitX}
        y={arc.hitY}
        width={arc.hitW}
        height={arc.hitH}
        fill="transparent"
        className={`shift-arrow-hit-area ${hasComment ? 'has-comment' : ''} ${isOpen ? 'open' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          onToggleComment()
        }}
      />
      <text
        x={arc.labelX}
        y={arc.labelY}
        textAnchor="middle"
        className={`shift-days-label ${hasComment ? 'has-comment' : ''}`}
        fill={color}
        style={{ pointerEvents: 'none' }}
      >
        {deltaDays > 0 ? '+' : ''}
        {deltaDays}d
        {hasComment ? ' 💬' : ''}
      </text>
      {showShiftComments && commentSnippet ? (
        <text
          x={arc.labelX}
          y={position === 'above' ? arc.labelY - 12 : arc.labelY + 14}
          textAnchor="middle"
          className="shift-comment-gantt-label"
          fill="#64748b"
          style={{ pointerEvents: 'none' }}
        >
          {commentSnippet}
        </text>
      ) : null}
      {isOpen ? (
        <foreignObject x={popoverX} y={arc.popoverY} width={220} height={140}>
          <div className="shift-comment-foreign-root">
            <ShiftCommentPopover
              label={popoverLabel}
              comment={comment}
              saved={Boolean(saved)}
              onChange={onCommentChange}
              onClose={onClosePopover}
            />
          </div>
        </foreignObject>
      ) : null}
    </g>
  )
}
