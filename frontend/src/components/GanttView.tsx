import { useEffect, useMemo, useRef, useState } from 'react'
import { ShiftCommentPopover } from './ShiftCommentPopover'
import { useEffectiveTasks } from '../hooks/useEffectiveTasks'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useSavedDateShiftsStore } from '../stores/savedDateShiftsStore'
import { useUIStore } from '../stores/uiStore'
import type { Category, ProjectDetail, Task } from '../types'
import { buildTaskGroups, getGroupDateRange, type GroupDateRanges } from '../utils/taskGroups'
import {
  collectPriorityKeys,
  filterTasksByPriority,
  isPriorityFilterActive,
  priorityColor,
  priorityLabel,
  togglePriorityFilter,
  type PriorityFilterKey,
} from '../utils/priority'
import { formatLocaleMonthYear, ru } from '../locale/ru'
import {
  addDays,
  daysBetween,
  fmtDate,
  getTaskDateShift,
  getShiftArrowSegments,
  parseDate,
  savedMilestoneShiftToDelta,
  savedTaskShiftToDateShift,
  shiftArrowLineCoords,
} from '../utils/dateShift'

const ROW_H = 44
const LABEL_W = 220
const HEADER_H = 48

interface Props {
  project: ProjectDetail
}

export function GanttView({ project }: Props) {
  const effectiveTasks = useEffectiveTasks(project.tasks)
  const effectiveById = useMemo(
    () => new Map(effectiveTasks.map((t) => [t.id, t])),
    [effectiveTasks]
  )
  const baseById = useMemo(() => new Map(project.tasks.map((t) => [t.id, t])), [project.tasks])
  const showIndicative = useUIStore((s) => s.showIndicative)
  const showShiftComments = useUIStore((s) => s.showShiftComments)
  const activeShiftCommentKey = useUIStore((s) => s.activeShiftCommentKey)
  const setActiveShiftCommentKey = useUIStore((s) => s.setActiveShiftCommentKey)
  const groupingMode = useUIStore((s) => s.groupingMode)
  const collapsedGroupKeys = useUIStore((s) => s.collapsedGroupKeys)
  const toggleGroupCollapsed = useUIStore((s) => s.toggleGroupCollapsed)
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const ganttShowPriority = useUIStore((s) => s.ganttShowPriority)
  const setGanttShowPriority = useUIStore((s) => s.setGanttShowPriority)
  const ganttPriorityFilter = useUIStore((s) => s.ganttPriorityFilter)
  const setGanttPriorityFilter = useUIStore((s) => s.setGanttPriorityFilter)
  const pendingTasks = usePendingChangesStore((s) => s.taskChanges)
  const pendingMilestones = usePendingChangesStore((s) => s.milestones)
  const savedTaskShifts = useSavedDateShiftsStore((s) => s.taskShifts)
  const savedMilestoneShifts = useSavedDateShiftsStore((s) => s.milestoneShifts)
  const stageTaskDates = usePendingChangesStore((s) => s.stageTaskDates)
  const stageMilestone = usePendingChangesStore((s) => s.stageMilestone)
  const setTaskShiftComment = usePendingChangesStore((s) => s.setTaskShiftComment)
  const setMilestoneShiftComment = usePendingChangesStore((s) => s.setMilestoneShiftComment)
  const svgRef = useRef<SVGSVGElement>(null)

  const [drag, setDrag] = useState<{
    taskId: number
    taskName: string
    version: number
    mode: 'move' | 'resize-end'
    startX: number
    origStart: Date
    origEnd: Date
    originalStart: string | null
    originalEnd: string | null
  } | null>(null)

  const [dragPreview, setDragPreview] = useState<{
    taskId: number
    start: Date
    end: Date
  } | null>(null)

  const [msDrag, setMsDrag] = useState<{
    id: number
    name: string
    startX: number
    origDate: Date
    originalDate: string
  } | null>(null)

  const [msPreview, setMsPreview] = useState<{ id: number; date: Date } | null>(null)

  const priorityKeys = useMemo(() => collectPriorityKeys(effectiveTasks), [effectiveTasks])
  const filteredTasks = useMemo(
    () => filterTasksByPriority(effectiveTasks, ganttPriorityFilter),
    [effectiveTasks, ganttPriorityFilter]
  )

  const priorityFilterLabel = (key: PriorityFilterKey) =>
    key === 'none' ? ru.gantt.priorityNone : ru.gantt.priorityLabel(key)

  const handlePriorityToggle = (key: PriorityFilterKey) => {
    setGanttPriorityFilter(togglePriorityFilter(key, priorityKeys, ganttPriorityFilter))
  }

  const getTaskDates = (task: Task): { start: Date | null; end: Date | null; pending: boolean } => {
    if (dragPreview?.taskId === task.id) {
      return { start: dragPreview.start, end: dragPreview.end, pending: true }
    }
    const base = baseById.get(task.id) ?? task
    const effective = effectiveById.get(task.id) ?? task
    return {
      start: parseDate(effective.start_date),
      end: parseDate(effective.end_date),
      pending:
        base.start_date !== effective.start_date || base.end_date !== effective.end_date,
    }
  }

  const getMilestoneDate = (id: number, dateStr: string): { date: Date; pending: boolean } => {
    if (msPreview?.id === id) return { date: msPreview.date, pending: true }
    const pending = pendingMilestones[id]
    if (pending) return { date: parseDate(pending.date)!, pending: true }
    return { date: parseDate(dateStr)!, pending: false }
  }

  const getTaskIndicativeDates = (task: Task): { start: Date | null; end: Date | null } => {
    const effective = effectiveById.get(task.id) ?? task
    return {
      start: parseDate(effective.indicative_start),
      end: parseDate(effective.indicative_end),
    }
  }

  const { minDate, maxDate, dayWidth, rows, milestones } = useMemo(() => {
    const dates: Date[] = []
    filteredTasks.forEach((t) => {
      const { start, end } = getTaskDates(t)
      const { start: indStart, end: indEnd } = getTaskIndicativeDates(t)
      ;[start, end, indStart, indEnd].forEach((d) => {
        if (d) dates.push(d)
      })
      const change = pendingTasks[t.id]
      if (change?.original) {
        ;[change.original.start_date, change.original.end_date].forEach((d) => {
          const p = parseDate(d as string)
          if (p) dates.push(p)
        })
      }
      const savedList = savedTaskShifts[t.id] ?? []
      for (const saved of savedList) {
        ;[saved.origStart, saved.origEnd, saved.curStart, saved.curEnd].forEach((d) => {
          const p = parseDate(d)
          if (p) dates.push(p)
        })
      }
    })
    project.milestones.forEach((m) => {
      const { date } = getMilestoneDate(m.id, m.date)
      if (date) dates.push(date)
      const pm = pendingMilestones[m.id]
      if (pm) {
        const orig = parseDate(pm.original_date)
        if (orig) dates.push(orig)
      }
      const savedMsList = savedMilestoneShifts[m.id] ?? []
      for (const savedMs of savedMsList) {
        const orig = parseDate(savedMs.original_date)
        const cur = parseDate(savedMs.date)
        if (orig) dates.push(orig)
        if (cur) dates.push(cur)
      }
    })
    if (!dates.length) {
      const now = new Date()
      dates.push(now, addDays(now, 90))
    }
    const min = addDays(new Date(Math.min(...dates.map((d) => d.getTime()))), -7)
    const max = addDays(new Date(Math.max(...dates.map((d) => d.getTime()))), 14)
    const dayWidth = 18

    const catMap = new Map(project.categories.map((c) => [c.id, c]))
    const groups = buildTaskGroups(filteredTasks, project.categories, groupingMode).filter(
      (g) => g.tasks.length > 0
    )

    const rows: {
      task?: Task
      category?: Category
      laneLabel?: string
      groupKey?: string
      groupColor?: string
      taskCount?: number
      groupDateRanges?: GroupDateRanges
    }[] = []

    for (const g of groups) {
      if (groupingMode === 'swimlane') {
        if (!g.tasks.length) continue
        const groupDateRanges: GroupDateRanges = {
          actual: getGroupDateRange(g.tasks, (t) => getTaskDates(t)),
          indicative: getGroupDateRange(g.tasks, (t) => getTaskIndicativeDates(t)),
        }
        rows.push({
          laneLabel: g.label,
          groupKey: g.key,
          groupColor: g.color,
          taskCount: g.tasks.length,
          groupDateRanges,
        })
        if (!collapsedGroupKeys.includes(g.key)) {
          for (const t of g.tasks) {
            rows.push({
              task: t,
              category: t.category_id ? catMap.get(t.category_id) : undefined,
            })
          }
        }
      } else {
        for (const t of g.tasks) {
          rows.push({
            task: t,
            category: t.category_id ? catMap.get(t.category_id) : undefined,
          })
        }
      }
    }

    return { minDate: min, maxDate: max, dayWidth, rows, milestones: project.milestones }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, groupingMode, collapsedGroupKeys, filteredTasks, pendingTasks, pendingMilestones, savedTaskShifts, savedMilestoneShifts, dragPreview, msPreview])

  const chartW = daysBetween(minDate, maxDate) * dayWidth
  const chartH = rows.length * ROW_H + HEADER_H

  const xForDate = (d: Date) => daysBetween(minDate, d) * dayWidth + LABEL_W

  const depLines = useMemo(() => {
    const taskIndex = new Map<number, number>()
    rows.forEach((r, i) => {
      if (r.task?.id) taskIndex.set(r.task.id, i)
    })
    return project.dependencies
      .map((dep) => {
        const predIdx = taskIndex.get(dep.predecessor_id)
        const succIdx = taskIndex.get(dep.successor_id)
        if (predIdx === undefined || succIdx === undefined) return null
        const pred = effectiveById.get(dep.predecessor_id)
        const succ = effectiveById.get(dep.successor_id)
        if (!pred || !succ) return null
        const predDates = getTaskDates(pred)
        const succDates = getTaskDates(succ)
        if (!predDates.end || !succDates.start) return null
        const x1 = xForDate(predDates.end)
        const y1 = HEADER_H + predIdx * ROW_H + ROW_H / 2
        const x2 = xForDate(succDates.start)
        const y2 = HEADER_H + succIdx * ROW_H + ROW_H / 2
        return { id: dep.id, x1, y1, x2, y2 }
      })
      .filter(Boolean) as { id: number; x1: number; y1: number; x2: number; y2: number }[]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, rows, minDate, dayWidth, pendingTasks, dragPreview, effectiveById])

  const finishTaskDrag = (clientX: number) => {
    if (!drag) return
    const deltaDays = Math.round((clientX - drag.startX) / dayWidth)
    const savedDrag = drag
    setDrag(null)
    setDragPreview(null)
    if (deltaDays === 0) return

    let newStart = savedDrag.origStart
    let newEnd = savedDrag.origEnd
    if (savedDrag.mode === 'move') {
      newStart = addDays(savedDrag.origStart, deltaDays)
      newEnd = addDays(savedDrag.origEnd, deltaDays)
    } else {
      newEnd = addDays(savedDrag.origEnd, deltaDays)
      if (newEnd < newStart) newEnd = newStart
    }

    const task = project.tasks.find((t) => t.id === savedDrag.taskId)
    if (!task) return
    stageTaskDates(task, fmtDate(newStart), fmtDate(newEnd))
  }

  const finishMsDrag = (clientX: number) => {
    if (!msDrag) return
    const deltaDays = Math.round((clientX - msDrag.startX) / dayWidth)
    const saved = msDrag
    setMsDrag(null)
    setMsPreview(null)
    if (deltaDays === 0) return
    stageMilestone({
      milestoneId: saved.id,
      name: saved.name,
      date: fmtDate(addDays(saved.origDate, deltaDays)),
      original_date: saved.originalDate,
    })
  }

  useEffect(() => {
    if (!drag && !msDrag) return
    const onUp = (e: PointerEvent) => {
      if (msDrag) finishMsDrag(e.clientX)
      else if (drag) finishTaskDrag(e.clientX)
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, msDrag, dayWidth, project.tasks])

  const onPointerDown = (e: React.PointerEvent, task: Task, mode: 'move' | 'resize-end') => {
    const { start, end } = getTaskDates(task)
    if (!start || !end) return
    e.stopPropagation()
    e.preventDefault()
    const change = pendingTasks[task.id]
    setDrag({
      taskId: task.id,
      taskName: task.name,
      version: task.version,
      mode,
      startX: e.clientX,
      origStart: start,
      origEnd: end,
      originalStart: (change?.original?.start_date as string) ?? task.start_date,
      originalEnd: (change?.original?.end_date as string) ?? task.end_date,
    })
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (msDrag) {
      const deltaDays = Math.round((e.clientX - msDrag.startX) / dayWidth)
      setMsPreview({ id: msDrag.id, date: addDays(msDrag.origDate, deltaDays) })
      return
    }
    if (!drag) return
    const deltaDays = Math.round((e.clientX - drag.startX) / dayWidth)
    let newStart = drag.origStart
    let newEnd = drag.origEnd
    if (drag.mode === 'move') {
      newStart = addDays(drag.origStart, deltaDays)
      newEnd = addDays(drag.origEnd, deltaDays)
    } else {
      newEnd = addDays(drag.origEnd, deltaDays)
      if (newEnd < newStart) newEnd = newStart
    }
    setDragPreview({ taskId: drag.taskId, start: newStart, end: newEnd })
  }

  type BarDateShift = {
    origStart: Date
    origEnd: Date
    newStart: Date
    newEnd: Date
    startDelta: number
    endDelta: number
    saved: boolean
    comment?: string
    entityKey: string
    entityLabel: string
    onCommentChange?: (comment: string) => void
  }

  const getDateShifts = (task: Task): BarDateShift[] => {
    const shifts: BarDateShift[] = []

    for (const [index, saved] of (savedTaskShifts[task.id] ?? []).entries()) {
      const savedShift = savedTaskShiftToDateShift(saved)
      if (savedShift) {
        shifts.push({
          origStart: savedShift.origStart,
          origEnd: savedShift.origEnd,
          newStart: savedShift.curStart,
          newEnd: savedShift.curEnd,
          startDelta: savedShift.startDelta,
          endDelta: savedShift.endDelta,
          saved: true,
          comment: saved.shiftComment,
          entityKey: `gantt-task-${task.id}-${index}`,
          entityLabel: task.name,
        })
      }
    }

    if (dragPreview?.taskId === task.id && drag) {
      const baselineStart = parseDate(drag.originalStart) ?? drag.origStart
      const baselineEnd = parseDate(drag.originalEnd) ?? drag.origEnd
      if (baselineStart && baselineEnd) {
        const startDelta = daysBetween(baselineStart, dragPreview.start)
        const endDelta = daysBetween(baselineEnd, dragPreview.end)
        if (startDelta !== 0 || endDelta !== 0) {
          shifts.push({
            origStart: baselineStart,
            origEnd: baselineEnd,
            newStart: dragPreview.start,
            newEnd: dragPreview.end,
            startDelta,
            endDelta,
            saved: false,
            comment: pendingTasks[task.id]?.shiftComment,
            entityKey: `gantt-task-${task.id}-pending`,
            entityLabel: task.name,
            onCommentChange: (c) => setTaskShiftComment(task.id, c),
          })
        }
      }
      return shifts
    }

    const change = pendingTasks[task.id]
    const shift = getTaskDateShift(task, change)
    if (shift) {
      shifts.push({
        origStart: shift.origStart,
        origEnd: shift.origEnd,
        newStart: shift.curStart,
        newEnd: shift.curEnd,
        startDelta: shift.startDelta,
        endDelta: shift.endDelta,
        saved: false,
        comment: change?.shiftComment,
        entityKey: `gantt-task-${task.id}-pending`,
        entityLabel: task.name,
        onCommentChange: (c) => setTaskShiftComment(task.id, c),
      })
    }

    return shifts
  }

  const renderDateShiftArrow = (task: Task, rowY: number) => {
    const shifts = getDateShifts(task)
    if (!shifts.length) return null

    const toggleComment = (key: string) => {
      setActiveShiftCommentKey(activeShiftCommentKey === key ? null : key)
    }

    return (
      <g className="date-shift-indicator">
        {shifts.map((shift, shiftIndex) => {
          const origX = xForDate(shift.origStart)
          const newX = xForDate(shift.newStart)
          const origBarW = Math.max(daysBetween(shift.origStart, shift.origEnd) * dayWidth, 6)
          const newBarW = Math.max(daysBetween(shift.newStart, shift.newEnd) * dayWidth, 6)
          const origEndX = origX + origBarW
          const newEndX = newX + newBarW
          const hasComment = Boolean(shift.comment?.trim())
          const isOpen = activeShiftCommentKey === shift.entityKey

          const segments = getShiftArrowSegments({
            origStart: shift.origStart,
            origEnd: shift.origEnd,
            curStart: shift.newStart,
            curEnd: shift.newEnd,
            startDelta: shift.startDelta,
            endDelta: shift.endDelta,
          })
          if (!segments.length) return null

          const layerOffset = (shiftIndex - (shifts.length - 1) / 2) * 10

          return (
            <g key={`shift-${shiftIndex}`} opacity={shift.saved ? 0.7 : 1}>
              <rect
                x={origX}
                y={rowY + 14}
                width={origBarW}
                height={16}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={shift.saved ? 1.5 : 2}
                strokeDasharray="4 3"
                rx={3}
                style={{ pointerEvents: 'none' }}
              />
              {segments.map((segment, i) => {
                const shiftedRight = segment.deltaDays > 0
                const color = shiftedRight ? '#dc2626' : '#16a34a'
                const markerId = shiftedRight ? 'arrow-red' : 'arrow-green'
                const anchorX1 =
                  segment.edge === 'start' ? xForDate(segment.origPoint) : origEndX
                const anchorX2 =
                  segment.edge === 'start' ? xForDate(segment.curPoint) : newEndX
                const { lineX1, lineX2 } = shiftArrowLineCoords(anchorX1, anchorX2, shiftedRight)
                if (Math.abs(lineX2 - lineX1) < 2) return null

                const arrowY =
                  rowY +
                  22 +
                  layerOffset +
                  (segments.length > 1 ? (i === 0 ? -4 : 4) : 0)
                const midX = (lineX1 + lineX2) / 2
                const hitX = Math.min(lineX1, lineX2) - 6
                const hitW = Math.abs(lineX2 - lineX1) + 12
                const commentSnippet = shift.comment?.trim()
                  ? shift.comment!.length > 40
                    ? `${shift.comment!.slice(0, 40).trim()}…`
                    : shift.comment
                  : ''

                return (
                  <g key={`${segment.edge}-${i}`} className="shift-arrow-gantt">
                    <line
                      x1={lineX1}
                      y1={arrowY}
                      x2={lineX2}
                      y2={arrowY}
                      stroke={color}
                      strokeWidth={shift.saved ? 2 : 3}
                      markerEnd={`url(#${markerId})`}
                      style={{ pointerEvents: 'none' }}
                    />
                    <rect
                      x={hitX}
                      y={arrowY - 14}
                      width={hitW}
                      height={28}
                      fill="transparent"
                      className={`shift-arrow-hit-area ${hasComment ? 'has-comment' : ''} ${isOpen ? 'open' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleComment(shift.entityKey)
                      }}
                    />
                    <text
                      x={midX}
                      y={arrowY - 6}
                      textAnchor="middle"
                      className={`shift-days-label ${hasComment ? 'has-comment' : ''}`}
                      fill={color}
                      style={{ pointerEvents: 'none' }}
                    >
                      {segment.deltaDays > 0 ? '+' : ''}
                      {segment.deltaDays}d
                      {hasComment ? ' 💬' : ''}
                    </text>
                    {showShiftComments && commentSnippet && i === 0 ? (
                      <text
                        x={midX}
                        y={arrowY + 14}
                        textAnchor="middle"
                        className="shift-comment-gantt-label"
                        fill="#64748b"
                        style={{ pointerEvents: 'none' }}
                      >
                        {commentSnippet}
                      </text>
                    ) : null}
                    {isOpen && i === 0 ? (
                      <foreignObject
                        x={Math.max(LABEL_W, midX - 110)}
                        y={arrowY + (showShiftComments && commentSnippet ? 20 : 10)}
                        width={220}
                        height={140}
                      >
                        <div className="shift-comment-foreign-root">
                          <ShiftCommentPopover
                            label={ru.shift.dateShift(shift.entityLabel)}
                            comment={shift.comment ?? ''}
                            saved={shift.saved}
                            onChange={shift.onCommentChange}
                            onClose={() => setActiveShiftCommentKey(null)}
                          />
                        </div>
                      </foreignObject>
                    ) : null}
                  </g>
                )
              })}
            </g>
          )
        })}
      </g>
    )
  }

  const getMilestoneShifts = (
    ms: { id: number; name: string; date: string }
  ): {
    orig: Date
    next: Date
    deltaDays: number
    saved: boolean
    comment?: string
    entityKey: string
    onCommentChange?: (comment: string) => void
  }[] => {
    const shifts: {
      orig: Date
      next: Date
      deltaDays: number
      saved: boolean
      comment?: string
      entityKey: string
      onCommentChange?: (comment: string) => void
    }[] = []

    for (const [index, saved] of (savedMilestoneShifts[ms.id] ?? []).entries()) {
      const delta = savedMilestoneShiftToDelta(saved)
      if (delta) {
        shifts.push({
          ...delta,
          saved: true,
          comment: saved.shiftComment,
          entityKey: `gantt-ms-${ms.id}-${index}`,
        })
      }
    }

    if (msPreview?.id === ms.id && msDrag) {
      const delta = daysBetween(msDrag.origDate, msPreview.date)
      if (delta !== 0) {
        const orig = parseDate(msDrag.originalDate)
        if (orig) {
          shifts.push({
            orig,
            next: msPreview.date,
            deltaDays: delta,
            saved: false,
            comment: pendingMilestones[ms.id]?.shiftComment,
            entityKey: `gantt-ms-${ms.id}-pending`,
            onCommentChange: pendingMilestones[ms.id]
              ? (c) => setMilestoneShiftComment(ms.id, c)
              : undefined,
          })
        }
      }
      return shifts
    }

    const pending = pendingMilestones[ms.id]
    const current = getMilestoneDate(ms.id, ms.date)
    if (pending) {
      const orig = parseDate(pending.original_date)
      if (orig) {
        const delta = daysBetween(orig, current.date)
        if (delta !== 0) {
          shifts.push({
            orig,
            next: current.date,
            deltaDays: delta,
            saved: false,
            comment: pending.shiftComment,
            entityKey: `gantt-ms-${ms.id}-pending`,
            onCommentChange: (c) => setMilestoneShiftComment(ms.id, c),
          })
        }
      }
    }

    return shifts
  }

  const renderMilestoneShiftArrow = (ms: { id: number; name: string; date: string }) => {
    const shifts = getMilestoneShifts(ms)
    if (!shifts.length) return null

    const toggleComment = (key: string) => {
      setActiveShiftCommentKey(activeShiftCommentKey === key ? null : key)
    }

    return (
      <g>
        {shifts.map((shift, shiftIndex) => {
          const shiftedRight = shift.deltaDays > 0
          const color = shiftedRight ? '#dc2626' : '#16a34a'
          const markerId = shiftedRight ? 'arrow-red' : 'arrow-green'
          const xOrig = xForDate(shift.orig)
          const xNew = xForDate(shift.next)
          const y = HEADER_H + 6 + (shiftIndex - (shifts.length - 1) / 2) * 8
          const { lineX1, lineX2 } = shiftArrowLineCoords(xOrig, xNew, shiftedRight)
          if (Math.abs(lineX2 - lineX1) < 2) return null
          const midX = (lineX1 + lineX2) / 2
          const hasComment = Boolean(shift.comment?.trim())
          const isOpen = activeShiftCommentKey === shift.entityKey
          const commentSnippet = shift.comment?.trim()
            ? shift.comment!.length > 40
              ? `${shift.comment!.slice(0, 40).trim()}…`
              : shift.comment
            : ''

          return (
            <g key={`ms-shift-${shiftIndex}`} opacity={shift.saved ? 0.7 : 1}>
              <polygon
                points={`${xOrig},${HEADER_H - 4} ${xOrig + 8},${HEADER_H + 8} ${xOrig},${HEADER_H + 20} ${xOrig - 8},${HEADER_H + 8}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="3 2"
                style={{ pointerEvents: 'none' }}
              />
              <line
                x1={lineX1}
                y1={y}
                x2={lineX2}
                y2={y}
                stroke={color}
                strokeWidth={shift.saved ? 2 : 2.5}
                markerEnd={`url(#${markerId})`}
                style={{ pointerEvents: 'none' }}
              />
              <rect
                x={Math.min(lineX1, lineX2) - 6}
                y={y - 14}
                width={Math.abs(lineX2 - lineX1) + 12}
                height={28}
                fill="transparent"
                className={`shift-arrow-hit-area ${hasComment ? 'has-comment' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleComment(shift.entityKey)
                }}
              />
              <text
                x={midX}
                y={y - 6}
                textAnchor="middle"
                className="shift-days-label"
                fill={color}
                style={{ pointerEvents: 'none' }}
              >
                {shift.deltaDays > 0 ? '+' : ''}
                {shift.deltaDays}d
                {hasComment ? ' 💬' : ''}
              </text>
              {showShiftComments && commentSnippet ? (
                <text
                  x={midX}
                  y={y + 14}
                  textAnchor="middle"
                  className="shift-comment-gantt-label"
                  fill="#64748b"
                  style={{ pointerEvents: 'none' }}
                >
                  {commentSnippet}
                </text>
              ) : null}
              {isOpen ? (
                <foreignObject
                  x={Math.max(LABEL_W, midX - 110)}
                  y={y + (showShiftComments && commentSnippet ? 20 : 10)}
                  width={220}
                  height={140}
                >
                  <div className="shift-comment-foreign-root">
                    <ShiftCommentPopover
                      label={ru.shift.milestoneShift(ms.name)}
                      comment={shift.comment ?? ''}
                      saved={shift.saved}
                      onChange={shift.onCommentChange}
                      onClose={() => setActiveShiftCommentKey(null)}
                    />
                  </div>
                </foreignObject>
              ) : null}
            </g>
          )
        })}
      </g>
    )
  }

  const monthLabels = useMemo(() => {
    const labels: { x: number; text: string }[] = []
    let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (d <= maxDate) {
      labels.push({
        x: xForDate(d),
        text: formatLocaleMonthYear(d),
      })
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return labels
  }, [minDate, maxDate, dayWidth])

  const taskShiftOverlays = useMemo(() => {
    return rows
      .map((row, i) => {
        if (row.laneLabel || !row.task) return null
        return renderDateShiftArrow(row.task, HEADER_H + i * ROW_H)
      })
      .filter(Boolean)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, pendingTasks, savedTaskShifts, savedMilestoneShifts, dragPreview, drag, minDate, dayWidth, activeShiftCommentKey, showShiftComments, pendingMilestones])

  return (
    <div className="gantt-view">
      <div className="gantt-toolbar">
        <label className="toggle">
          <input
            type="checkbox"
            checked={ganttShowPriority}
            onChange={(e) => setGanttShowPriority(e.target.checked)}
          />
          {ru.gantt.showPriority}
        </label>
        <div className="gantt-priority-filter">
          <span className="gantt-priority-filter-title">{ru.gantt.filterTitle}:</span>
          <button
            type="button"
            className={`filter-chip ${ganttPriorityFilter === null ? 'active' : ''}`}
            onClick={() => setGanttPriorityFilter(null)}
          >
            {ru.gantt.filterAll}
          </button>
          {priorityKeys.map((key) => (
            <button
              key={String(key)}
              type="button"
              className={`filter-chip priority-chip ${isPriorityFilterActive(key, ganttPriorityFilter) ? 'active' : ''}`}
              style={{ '--priority-color': priorityColor(key === 'none' ? null : key) } as React.CSSProperties}
              onClick={() => handlePriorityToggle(key)}
            >
              {priorityFilterLabel(key)}
            </button>
          ))}
        </div>
        <span className="gantt-filter-count muted">
          {ru.gantt.shownCount(filteredTasks.length, effectiveTasks.length)}
        </span>
      </div>
      {filteredTasks.length === 0 ? (
        <div className="gantt-empty-filter">{ru.gantt.emptyFilter}</div>
      ) : (
    <div className="gantt-container">
      <svg
        ref={svgRef}
        width={LABEL_W + chartW + 40}
        height={chartH + 20}
        className="gantt-svg"
        onPointerMove={onPointerMove}
      >
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
          </marker>
          <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#dc2626" />
          </marker>
          <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#16a34a" />
          </marker>
        </defs>
        <rect x={0} y={0} width={LABEL_W + chartW} height={HEADER_H} fill="#f8fafc" />
        {monthLabels.map((m, i) => (
          <text key={i} x={m.x} y={28} className="gantt-month-label">
            {m.text}
          </text>
        ))}

        {rows.map((row, i) => {
          const y = HEADER_H + i * ROW_H
          if (row.laneLabel && row.groupKey) {
            const collapsed = collapsedGroupKeys.includes(row.groupKey)
            const ranges = row.groupDateRanges
            const laneColor = row.groupColor || '#64748b'
            const dateLabel = collapsed
              ? [
                  ranges?.actual &&
                    `${ru.groups.actual} ${fmtDate(ranges.actual.start)} – ${fmtDate(ranges.actual.end)}`,
                  ranges?.indicative &&
                    `${ru.groups.indicative} ${fmtDate(ranges.indicative.start)} – ${fmtDate(ranges.indicative.end)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : ''
            return (
              <g
                key={`lane-${row.groupKey}`}
                className="gantt-lane-header"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleGroupCollapsed(row.groupKey!)}
              >
                <rect x={0} y={y} width={LABEL_W + chartW} height={ROW_H} fill="#e2e8f0" />
                <rect x={0} y={y} width={4} height={ROW_H} fill={laneColor} />
                <text x={16} y={y + 26} className="lane-label">
                  {collapsed ? '▸' : '▾'} {row.laneLabel}
                  <tspan className="lane-count"> ({row.taskCount ?? 0})</tspan>
                  {dateLabel && <tspan className="lane-dates"> · {dateLabel}</tspan>}
                </text>
                {collapsed && showIndicative && ranges?.indicative && (
                  <rect
                    x={xForDate(ranges.indicative.start)}
                    y={y + 10}
                    width={Math.max(daysBetween(ranges.indicative.start, ranges.indicative.end) * dayWidth, 4)}
                    height={24}
                    fill={laneColor + '22'}
                    stroke={laneColor}
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    rx={4}
                  />
                )}
                {collapsed && ranges?.actual && (
                  <rect
                    x={xForDate(ranges.actual.start)}
                    y={y + 14}
                    width={Math.max(daysBetween(ranges.actual.start, ranges.actual.end) * dayWidth, 6)}
                    height={16}
                    fill={laneColor}
                    fillOpacity={0.45}
                    stroke={laneColor}
                    strokeWidth={1.5}
                    rx={3}
                  />
                )}
              </g>
            )
          }
          const task = row.task
          if (!task) return null
          const effective = effectiveById.get(task.id) ?? task
          const catColor = row.category?.color || '#94a3b8'
          const { start, end, pending } = getTaskDates(task)
          const indStart = parseDate(effective.indicative_start)
          const indEnd = parseDate(effective.indicative_end)
          const done = effective.completion_pct >= 100
          const pColor = priorityColor(effective.priority)
          const labelX = ganttShowPriority ? 34 : 8

          return (
            <g key={task.id}>
              <rect x={0} y={y} width={LABEL_W + chartW} height={ROW_H} fill={i % 2 ? '#fff' : '#fafafa'} />
              {ganttShowPriority && (
                <g onClick={() => setSelectedTaskId(task.id)} style={{ cursor: 'pointer' }}>
                  <rect x={4} y={y + 15} width={24} height={14} rx={3} fill={pColor} />
                  <text
                    x={16}
                    y={y + 25}
                    textAnchor="middle"
                    className="gantt-priority-badge"
                    fill="#fff"
                    fontSize={9}
                    fontWeight={600}
                  >
                    {priorityLabel(effective.priority)}
                  </text>
                </g>
              )}
              <text
                x={labelX}
                y={y + 26}
                className={`task-label ${done ? 'done' : ''}`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                {done ? '✓ ' : ''}
                {effective.name}
                {pending ? ' *' : ''}
              </text>
              {showIndicative && indStart && indEnd && (
                <rect
                  x={xForDate(indStart)}
                  y={y + 10}
                  width={Math.max(daysBetween(indStart, indEnd) * dayWidth, 4)}
                  height={24}
                  fill={catColor + '22'}
                  stroke={catColor}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  rx={4}
                />
              )}
              {start && end && (
                <g>
                  {ganttShowPriority && (
                    <rect
                      x={xForDate(start)}
                      y={y + 14}
                      width={4}
                      height={16}
                      fill={pColor}
                      rx={2}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  <rect
                    x={xForDate(start) + (ganttShowPriority ? 4 : 0)}
                    y={y + 14}
                    width={Math.max(daysBetween(start, end) * dayWidth - (ganttShowPriority ? 4 : 0), 6)}
                    height={16}
                    fill={catColor}
                    stroke={pending ? '#ea580c' : ganttShowPriority ? pColor : '#1e293b'}
                    strokeWidth={pending ? 2.5 : ganttShowPriority ? 2 : 1.5}
                    strokeDasharray={pending ? '4 2' : undefined}
                    rx={3}
                    className="gantt-bar"
                    onPointerDown={(e) => onPointerDown(e, task, 'move')}
                    onClick={() => setSelectedTaskId(task.id)}
                  />
                  <rect
                    x={xForDate(start)}
                    y={y + 14}
                    width={Math.max(daysBetween(start, end) * dayWidth, 6) * (effective.completion_pct / 100)}
                    height={16}
                    fill="#ffffff55"
                    rx={3}
                    style={{ pointerEvents: 'none' }}
                  />
                  <rect
                    x={xForDate(end) - 4}
                    y={y + 14}
                    width={8}
                    height={16}
                    fill="transparent"
                    className="resize-handle"
                    onPointerDown={(e) => onPointerDown(e, task, 'resize-end')}
                  />
                </g>
              )}
              {start && !end && (
                <rect
                  x={xForDate(start)}
                  y={y + 18}
                  width={8}
                  height={8}
                  fill={ganttShowPriority ? pColor : catColor}
                  stroke={pending ? '#ea580c' : '#1e293b'}
                  strokeWidth={pending ? 2 : 1}
                  rx={2}
                  className="gantt-bar gantt-bar-start-only"
                  onPointerDown={(e) => onPointerDown(e, task, 'move')}
                  onClick={() => setSelectedTaskId(task.id)}
                />
              )}
            </g>
          )
        })}

        <g className="shift-overlay-layer">{taskShiftOverlays}</g>

        {depLines.map((d) => (
          <g key={d.id}>
            <path
              d={`M ${d.x1} ${d.y1} C ${d.x1 + 20} ${d.y1}, ${d.x2 - 20} ${d.y2}, ${d.x2} ${d.y2}`}
              fill="none"
              stroke="#64748b"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
          </g>
        ))}

        {milestones.map((ms) => {
          const { date: d, pending } = getMilestoneDate(ms.id, ms.date)
          if (!d) return null
          const x = xForDate(d)
          return (
            <g key={ms.id} className="milestone">
              {renderMilestoneShiftArrow(ms)}
              <polygon
                points={`${x},${HEADER_H - 4} ${x + 8},${HEADER_H + 8} ${x},${HEADER_H + 20} ${x - 8},${HEADER_H + 8}`}
                fill={pending ? '#f97316' : '#dc2626'}
                stroke={pending ? '#c2410c' : '#991b1b'}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setMsDrag({
                    id: ms.id,
                    name: ms.name,
                    startX: e.clientX,
                    origDate: d,
                    originalDate: pendingMilestones[ms.id]?.original_date ?? ms.date,
                  })
                  ;(e.target as Element).setPointerCapture(e.pointerId)
                }}
              />
              <title>
                {ms.name}
                {pending ? ` (${ru.drawer.unsaved})` : ''}
              </title>
            </g>
          )
        })}

      </svg>
    </div>
      )}
    </div>
  )
}
