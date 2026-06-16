import { useState } from 'react'
import type { TaskDateShiftEntry } from '../hooks/useTaskDateShift'
import { useUIStore } from '../stores/uiStore'
import { fmtDate, getShiftArrowSegments } from '../utils/dateShift'
import { ShiftCommentPopover } from './ShiftCommentPopover'
import { ru } from '../locale/ru'

interface Props {
  shifts: TaskDateShiftEntry[]
  compact?: boolean
  entityKey: string
  entityLabel: string
}

function segmentLabel(segment: { deltaDays: number; edge: string }) {
  const label = `${segment.deltaDays > 0 ? '+' : ''}${segment.deltaDays}д`
  const edge =
    segment.edge === 'start' ? ru.shift.edgeStart : segment.edge === 'end' ? ru.shift.edgeEnd : ''
  return edge ? `${label} ${edge}` : label
}

function ShiftSegmentButton({
  color,
  arrow,
  label,
  title,
  hasComment,
  showCommentText,
  commentSnippet,
  compact,
  isOpen,
  onToggle,
  segmentKey,
}: {
  color: string
  arrow: string
  label: string
  title: string
  hasComment: boolean
  showCommentText: boolean
  commentSnippet?: string
  compact: boolean
  isOpen: boolean
  onToggle: () => void
  segmentKey: string
}) {
  return (
    <span className={`shift-arrow-hit ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        className={`shift-arrow-btn ${hasComment ? 'has-comment' : ''} ${isOpen ? 'open' : ''}`}
        style={{ color }}
        title={title}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        aria-expanded={isOpen}
        aria-controls={`shift-popover-${segmentKey}`}
      >
        {arrow} {label}
        {hasComment ? <span className="shift-comment-dot" aria-hidden /> : null}
      </button>
      {showCommentText && commentSnippet ? (
        <span className="shift-comment-snippet">{commentSnippet}</span>
      ) : null}
    </span>
  )
}

export function DateShiftIndicator({ shifts, compact, entityKey, entityLabel }: Props) {
  const showShiftComments = useUIStore((s) => s.showShiftComments)
  const activeKey = useUIStore((s) => s.activeShiftCommentKey)
  const setActiveKey = useUIStore((s) => s.setActiveShiftCommentKey)
  const [localKey, setLocalKey] = useState<string | null>(null)

  if (!shifts.length) return null

  const openKey = activeKey?.startsWith(`${entityKey}:`) ? activeKey : localKey

  const toggle = (key: string) => {
    const next = openKey === key ? null : key
    setActiveKey(next)
    setLocalKey(next)
  }

  const close = () => {
    setActiveKey(null)
    setLocalKey(null)
  }

  const nodes = shifts.flatMap((entry, entryIndex) => {
    const segments = getShiftArrowSegments({
      origStart: entry.shift.origStart,
      origEnd: entry.shift.origEnd,
      curStart: entry.shift.curStart,
      curEnd: entry.shift.curEnd,
      startDelta: entry.shift.startDelta,
      endDelta: entry.shift.endDelta,
    })
    const comment = entry.comment ?? ''
    const hasComment = comment.trim().length > 0
    const title = [
      ru.shift.was(fmtDate(entry.shift.origStart), fmtDate(entry.shift.origEnd)),
      entry.saved ? ru.shift.saved : ru.shift.unsaved,
      hasComment ? ru.shift.comment(comment) : ru.shift.clickToComment,
    ].join(' · ')
    const snippet = comment.length > 48 ? `${comment.slice(0, 48).trim()}…` : comment
    const popoverKey = `${entityKey}:${entryIndex}`

    return segments.map((segment, segIndex) => {
      const segmentKey = `${entityKey}:${entryIndex}:${segment.edge}:${segIndex}`
      const isOpen = openKey === popoverKey

      return (
        <span key={segmentKey} className="shift-arrow-wrap">
          <ShiftSegmentButton
            color={segment.deltaDays > 0 ? '#dc2626' : '#16a34a'}
            arrow={segment.deltaDays > 0 ? '→' : '←'}
            label={segmentLabel(segment)}
            title={title}
            hasComment={hasComment}
            showCommentText={showShiftComments && hasComment}
            commentSnippet={snippet}
            compact={Boolean(compact)}
            isOpen={isOpen}
            onToggle={() => toggle(popoverKey)}
            segmentKey={segmentKey}
          />
          {isOpen ? (
            <div id={`shift-popover-${segmentKey}`} className="shift-comment-popover-anchor">
              <ShiftCommentPopover
                label={ru.shift.dateShift(entityLabel)}
                comment={comment}
                saved={entry.saved}
                onChange={entry.onCommentChange}
                onClose={close}
              />
            </div>
          ) : null}
        </span>
      )
    })
  })

  if (compact) {
    return <span className="date-shift-indicator compact">{nodes}</span>
  }

  return <span className="date-shift-indicator-group">{nodes}</span>
}
