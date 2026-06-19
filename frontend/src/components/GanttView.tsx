import { useEffect, useMemo, useRef, useState } from 'react'
import { GanttShiftArcSegment } from './GanttShiftArcSegment'
import { useEffectiveTasks } from '../hooks/useEffectiveTasks'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useSavedDateShiftsStore } from '../stores/savedDateShiftsStore'
import { useUIStore } from '../stores/uiStore'
import type { ProjectDetail, Task } from '../types'
import { buildTaskGroups, getGroupDateRange } from '../utils/taskGroups'
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
  savedTaskShiftStillRelevant,
  savedTaskShiftToDateShift,
} from '../utils/dateShift'
import { ganttBarEndX, ganttBarWidthPx, inclusiveDaysBetween } from '../utils/ganttBar'
import {
  buildGanttRows,
  chartHeightFromLayouts,
  computeGanttRowLayouts,
  GANTT_HEADER_H,
  GANTT_STAGE_BAR_H,
  GANTT_STAGE_ROW_BAR_TOP,
  GANTT_STAGE_ROW_H,
  GANTT_TASK_ROW_STAGE_BAR_TOP,
  taskHasGanttStages,
  type GanttRowLayout,
} from '../utils/ganttRows'
import {
  collectStageDependencyLinks,
  getStageBarRange,
  stageDependencyFromX,
  stageDependencyToX,
} from '../utils/ganttStageDeps'
import { shiftArcLayer, shiftArcPositionForEdge } from '../utils/ganttShiftArc'
import { sortedSubStages } from '../utils/subStageDates'
import { stageDisplayNumber } from '../utils/subStageDeps'
import { savedStageShiftToBarShift } from '../utils/stageShift'

function indicativeBarDates(start: Date | null, end: Date | null): { start: Date; end: Date } | null {
  if (start && end) return { start, end }
  if (start) return { start, end: start }
  if (end) return { start: end, end }
  return null
}

const LABEL_W = 220
const HEADER_H = GANTT_HEADER_H
const STAGE_BAR_TOP = GANTT_TASK_ROW_STAGE_BAR_TOP
const STAGE_BAR_H = GANTT_STAGE_BAR_H

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
  const ganttExpandedTaskIds = useUIStore((s) => s.ganttExpandedTaskIds)
  const toggleGanttTaskExpanded = useUIStore((s) => s.toggleGanttTaskExpanded)
  const isGanttTaskExpanded = useUIStore((s) => s.isGanttTaskExpanded)
  const pendingTasks = usePendingChangesStore((s) => s.taskChanges)
  const pendingMilestones = usePendingChangesStore((s) => s.milestones)
  const savedTaskShifts = useSavedDateShiftsStore((s) => s.taskShifts)
  const savedStageShifts = useSavedDateShiftsStore((s) => s.stageShifts)
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

  const { minDate, maxDate, dayWidth, ganttRows, milestones } = useMemo(() => {
    const dates: Date[] = []
    filteredTasks.forEach((t) => {
      const { start, end } = getTaskDates(t)
      const { start: indStart, end: indEnd } = getTaskIndicativeDates(t)
      ;[start, end, indStart, indEnd].forEach((d) => {
        if (d) dates.push(d)
      })
      for (const stage of t.sub_stages ?? []) {
        const range = getStageBarRange(stage)
        if (range) dates.push(range.start, range.end)
      }
      const change = pendingTasks[t.id]
      if (change?.original) {
        ;[change.original.start_date, change.original.end_date].forEach((d) => {
          const p = parseDate(d as string)
          if (p) dates.push(p)
        })
      }
      const savedList = (savedTaskShifts[t.id] ?? []).filter((saved) => {
        const effective = effectiveById.get(t.id) ?? t
        return savedTaskShiftStillRelevant(effective, saved)
      })
      for (const saved of savedList) {
        ;[saved.origStart, saved.origEnd, saved.curStart, saved.curEnd].forEach((d) => {
          const p = parseDate(d)
          if (p) dates.push(p)
        })
      }
      const savedStageList = savedStageShifts[t.id] ?? []
      for (const saved of savedStageList) {
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

    const ganttRows = buildGanttRows({
      tasks: filteredTasks,
      categories: project.categories,
      groupingMode,
      collapsedGroupKeys,
      expandedTaskIds: ganttExpandedTaskIds,
      buildGroups: (tasks, categories, mode) => buildTaskGroups(tasks, categories, mode),
      getGroupDateRanges: (tasks) => ({
        actual: getGroupDateRange(tasks, (t) => getTaskDates(t)),
        indicative: getGroupDateRange(tasks, (t) => getTaskIndicativeDates(t)),
      }),
    })

    return { minDate: min, maxDate: max, dayWidth, ganttRows, milestones: project.milestones }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, groupingMode, collapsedGroupKeys, ganttExpandedTaskIds, filteredTasks, pendingTasks, pendingMilestones, savedTaskShifts, savedStageShifts, savedMilestoneShifts, dragPreview, msPreview])

  const rowLayouts = useMemo(() => computeGanttRowLayouts(ganttRows), [ganttRows])

  const chartW = inclusiveDaysBetween(minDate, maxDate) * dayWidth
  const chartH = chartHeightFromLayouts(rowLayouts)

  const xForDate = (d: Date) => daysBetween(minDate, d) * dayWidth + LABEL_W

  const depLines = useMemo(() => {
    const taskLayoutById = new Map<number, GanttRowLayout>()
    const stageLayoutById = new Map<number, GanttRowLayout>()
    for (const layout of rowLayouts) {
      if (layout.row.kind === 'task') taskLayoutById.set(layout.row.task.id, layout)
      if (layout.row.kind === 'stage') stageLayoutById.set(layout.row.stage.id, layout)
    }

    const stageAnchor = (
      task: Task,
      stageId: number,
      edge: 'start' | 'end',
      taskLayout: GanttRowLayout
    ): { x: number; y: number } | null => {
      const stage = (task.sub_stages ?? []).find((s) => s.id === stageId)
      if (!stage) return null
      const range = getStageBarRange(stage)
      if (!range) return null

      const stageLayout = stageLayoutById.get(stageId)
      const y = stageLayout
        ? stageLayout.y + stageLayout.h / 2
        : taskLayout.y + taskLayout.h / 2

      if (edge === 'start') return { x: xForDate(range.start), y }
      return {
        x: ganttBarEndX(range.start, range.end, dayWidth, xForDate, 4),
        y,
      }
    }

    const taskAnchor = (
      task: Task,
      layout: GanttRowLayout,
      edge: 'start' | 'end'
    ): { x: number; y: number } | null => {
      const dates = getTaskDates(task)
      const y = layout.y + layout.h / 2
      if (edge === 'start' && dates.start) {
        return { x: xForDate(dates.start), y }
      }
      if (edge === 'end' && dates.start && dates.end) {
        return {
          x: ganttBarEndX(dates.start, dates.end, dayWidth, xForDate, 6),
          y,
        }
      }
      return null
    }

    return project.dependencies
      .map((dep) => {
        const pred = effectiveById.get(dep.predecessor_id)
        const succ = effectiveById.get(dep.successor_id)
        if (!pred || !succ) return null

        const predTaskLayout = taskLayoutById.get(dep.predecessor_id)
        const succTaskLayout = taskLayoutById.get(dep.successor_id)
        if (!predTaskLayout || !succTaskLayout) return null

        const predAnchor =
          dep.predecessor_stage_id != null
            ? stageAnchor(pred, dep.predecessor_stage_id, 'end', predTaskLayout)
            : taskAnchor(pred, predTaskLayout, 'end')
        const succAnchor =
          dep.successor_stage_id != null
            ? stageAnchor(succ, dep.successor_stage_id, 'start', succTaskLayout)
            : taskAnchor(succ, succTaskLayout, 'start')

        if (!predAnchor || !succAnchor) return null

        const x1 = predAnchor.x
        const y1 = predAnchor.y
        const x2 = succAnchor.x
        const y2 = succAnchor.y

        const predStage = dep.predecessor_stage_id
          ? pred.sub_stages?.find((s) => s.id === dep.predecessor_stage_id)
          : null
        const succStage = dep.successor_stage_id
          ? succ.sub_stages?.find((s) => s.id === dep.successor_stage_id)
          : null
        const title = [
          pred.name,
          predStage ? ` / ${predStage.name}` : '',
          ' → ',
          succ.name,
          succStage ? ` / ${succStage.name}` : '',
          ` (${dep.type})`,
        ].join('')

        return {
          id: dep.id,
          x1,
          y1,
          x2,
          y2,
          title,
          stageLevel: Boolean(dep.predecessor_stage_id != null || dep.successor_stage_id != null),
        }
      })
      .filter(Boolean) as {
      id: number
      x1: number
      y1: number
      x2: number
      y2: number
      title: string
      stageLevel: boolean
    }[]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, rowLayouts, minDate, dayWidth, pendingTasks, dragPreview, effectiveById])

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
    const effective = effectiveById.get(task.id) ?? task

    for (const [index, saved] of (savedTaskShifts[task.id] ?? []).entries()) {
      if (!savedTaskShiftStillRelevant(effective, saved)) continue
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
          const origBarW = ganttBarWidthPx(shift.origStart, shift.origEnd, dayWidth, 6)
          const origEndX = ganttBarEndX(shift.origStart, shift.origEnd, dayWidth, xForDate, 6)
          const newEndX = ganttBarEndX(shift.newStart, shift.newEnd, dayWidth, xForDate, 6)
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
          const taskBarTop = rowY + 14
          const taskBarBottom = rowY + 30

          return (
            <g key={`shift-${shiftIndex}`} opacity={shift.saved ? 0.7 : 1}>
              <rect
                x={origX}
                y={taskBarTop}
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
                const fromX =
                  segment.edge === 'start' ? xForDate(segment.origPoint) : origEndX
                const toX =
                  segment.edge === 'start' ? xForDate(segment.curPoint) : newEndX
                const commentSnippet = shift.comment?.trim()
                  ? shift.comment!.length > 40
                    ? `${shift.comment!.slice(0, 40).trim()}…`
                    : shift.comment
                  : ''

                return (
                  <GanttShiftArcSegment
                    key={`${segment.edge}-${i}`}
                    fromX={fromX}
                    toX={toX}
                    barTop={taskBarTop}
                    barBottom={taskBarBottom}
                    position={shiftArcPositionForEdge(segment.edge, 'task')}
                    layer={shiftArcLayer(shiftIndex, i, segment.edge, 'task') + layerOffset / 14}
                    color={color}
                    markerId={markerId}
                    strokeWidth={shift.saved ? 2 : 3}
                    deltaDays={segment.deltaDays}
                    saved={shift.saved}
                    hasComment={hasComment}
                    commentSnippet={i === 0 ? commentSnippet : undefined}
                    showShiftComments={showShiftComments}
                    isOpen={isOpen && i === 0}
                    onToggleComment={() => toggleComment(shift.entityKey)}
                    popoverLabel={ru.shift.dateShift(shift.entityLabel)}
                    comment={shift.comment ?? ''}
                    onCommentChange={shift.onCommentChange}
                    onClosePopover={() => setActiveShiftCommentKey(null)}
                    popoverX={Math.max(LABEL_W, (fromX + toX) / 2 - 110)}
                  />
                )
              })}
            </g>
          )
        })}
      </g>
    )
  }

  const renderStageDateShiftArrow = (
    task: Task,
    rowY: number,
    rowH: number,
    stageId?: number
  ) => {
    const existingStageIds = new Set(
      (task.sub_stages ?? []).filter((s) => s.is_indicative).map((s) => s.id)
    )
    const entries = (savedStageShifts[task.id] ?? []).filter(
      (saved) =>
        existingStageIds.has(saved.stageId) &&
        (stageId == null || saved.stageId === stageId)
    )
    if (!entries.length) return null

    const toggleComment = (key: string) => {
      setActiveShiftCommentKey(activeShiftCommentKey === key ? null : key)
    }

    const barTopOffset = rowH === GANTT_STAGE_ROW_H ? GANTT_STAGE_ROW_BAR_TOP : STAGE_BAR_TOP
    const stageBarTop = rowY + barTopOffset
    const stageBarBottom = rowY + barTopOffset + STAGE_BAR_H

    return (
      <g className="date-shift-indicator stage-date-shift">
        {entries.map((saved, shiftIndex) => {
          const shift = savedStageShiftToBarShift(saved)
          if (!shift) return null

          const origX = xForDate(shift.origStart)
          const origBarW = ganttBarWidthPx(shift.origStart, shift.origEnd, dayWidth, 4)
          const origEndX = ganttBarEndX(shift.origStart, shift.origEnd, dayWidth, xForDate, 4)
          const newEndX = ganttBarEndX(shift.curStart, shift.curEnd, dayWidth, xForDate, 4)
          const entityKey = `gantt-stage-${task.id}-${shift.stageId}-${shiftIndex}`
          const isOpen = activeShiftCommentKey === entityKey
          const hasComment = Boolean(shift.comment?.trim())
          const layerOffset = (shiftIndex - (entries.length - 1) / 2) * 8

          return (
            <g key={entityKey}>
              <rect
                x={origX}
                y={stageBarTop}
                width={origBarW}
                height={STAGE_BAR_H}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="3 2"
                rx={2}
                style={{ pointerEvents: 'none' }}
              />
              {shift.segments.map((segment, i) => {
                const shiftedRight = segment.deltaDays > 0
                const color = shiftedRight ? '#dc2626' : '#16a34a'
                const markerId = shiftedRight ? 'arrow-red' : 'arrow-green'
                const fromX =
                  segment.edge === 'start' ? xForDate(segment.origPoint) : origEndX
                const toX =
                  segment.edge === 'start' ? xForDate(segment.curPoint) : newEndX
                const commentSnippet = shift.comment?.trim()
                  ? shift.comment!.length > 36
                    ? `${shift.comment!.slice(0, 36).trim()}…`
                    : shift.comment
                  : ''

                return (
                  <GanttShiftArcSegment
                    key={`${segment.edge}-${i}`}
                    className="shift-arrow-gantt stage-shift-arrow"
                    fromX={fromX}
                    toX={toX}
                    barTop={stageBarTop}
                    barBottom={stageBarBottom}
                    position={shiftArcPositionForEdge(segment.edge, 'stage')}
                    layer={shiftArcLayer(shiftIndex, i, segment.edge, 'stage') + layerOffset / 14}
                    color={color}
                    markerId={markerId}
                    strokeWidth={2.5}
                    deltaDays={segment.deltaDays}
                    saved
                    hasComment={hasComment}
                    commentSnippet={i === 0 ? commentSnippet : undefined}
                    showShiftComments={showShiftComments}
                    isOpen={isOpen && i === 0}
                    onToggleComment={() => toggleComment(entityKey)}
                    popoverLabel={ru.gantt.stageDateShift(shift.stageName)}
                    comment={shift.comment ?? ''}
                    onClosePopover={() => setActiveShiftCommentKey(null)}
                    popoverX={Math.max(LABEL_W, (fromX + toX) / 2 - 110)}
                  />
                )
              })}
            </g>
          )
        })}
      </g>
    )
  }

  const renderExpandedStageDependencyArrows = (
    task: Task,
    stageLayoutById: Map<number, { y: number; h: number }>
  ) => {
    const links = collectStageDependencyLinks(task.sub_stages ?? [])
    if (!links.length) return null

    const rangeById = new Map(
      (task.sub_stages ?? [])
        .map((s) => [s.id, getStageBarRange(s)] as const)
        .filter((entry): entry is [number, NonNullable<ReturnType<typeof getStageBarRange>>] =>
          Boolean(entry[1])
        )
    )

    return (
      <g className="stage-dependency-layer">
        {links.map((link) => {
          const predLayout = stageLayoutById.get(link.predStageId)
          const succLayout = stageLayoutById.get(link.succStageId)
          const predRange = rangeById.get(link.predStageId)
          if (!predLayout || !succLayout || !predRange) return null

          const fromX = stageDependencyFromX(link.predEnd, link.predStart, dayWidth, xForDate)
          const toX = stageDependencyToX(link.succStart, xForDate)
          const y1 = predLayout.y + predLayout.h / 2
          const y2 = succLayout.y + succLayout.h / 2

          return (
            <path
              key={link.key}
              d={`M ${fromX} ${y1} C ${fromX + 20} ${y1}, ${toX - 20} ${y2}, ${toX} ${y2}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="5 3"
              markerEnd="url(#arrow-stage-dep)"
              strokeLinecap="round"
              className="stage-dep-arrow"
              opacity={0.9}
            >
              <title>
                {ru.gantt.stageDependency(
                  link.predNumber,
                  link.predName,
                  link.succNumber,
                  link.succName
                )}
              </title>
            </path>
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

    const msBarTop = HEADER_H - 4
    const msBarBottom = HEADER_H + 20

    return (
      <g>
        {shifts.map((shift, shiftIndex) => {
          const shiftedRight = shift.deltaDays > 0
          const color = shiftedRight ? '#dc2626' : '#16a34a'
          const markerId = shiftedRight ? 'arrow-red' : 'arrow-green'
          const xOrig = xForDate(shift.orig)
          const xNew = xForDate(shift.next)
          const hasComment = Boolean(shift.comment?.trim())
          const isOpen = activeShiftCommentKey === shift.entityKey
          const commentSnippet = shift.comment?.trim()
            ? shift.comment!.length > 40
              ? `${shift.comment!.slice(0, 40).trim()}…`
              : shift.comment
            : ''
          const layerOffset = (shiftIndex - (shifts.length - 1) / 2) * 8

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
              <GanttShiftArcSegment
                fromX={xOrig}
                toX={xNew}
                barTop={msBarTop}
                barBottom={msBarBottom}
                position={shiftArcPositionForEdge('start', 'milestone')}
                layer={shiftArcLayer(shiftIndex, 0, 'start', 'milestone') + layerOffset / 14}
                color={color}
                markerId={markerId}
                strokeWidth={shift.saved ? 2 : 2.5}
                deltaDays={shift.deltaDays}
                saved={shift.saved}
                hasComment={hasComment}
                commentSnippet={commentSnippet}
                showShiftComments={showShiftComments}
                isOpen={isOpen}
                onToggleComment={() => toggleComment(shift.entityKey)}
                popoverLabel={ru.shift.milestoneShift(ms.name)}
                comment={shift.comment ?? ''}
                onCommentChange={shift.onCommentChange}
                onClosePopover={() => setActiveShiftCommentKey(null)}
                popoverX={Math.max(LABEL_W, (xOrig + xNew) / 2 - 110)}
              />
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
    const expandedStageLayouts = new Map<number, Map<number, { y: number; h: number }>>()

    for (const layout of rowLayouts) {
      if (layout.row.kind !== 'stage') continue
      const taskId = layout.row.task.id
      if (!isGanttTaskExpanded(taskId)) continue
      let byStage = expandedStageLayouts.get(taskId)
      if (!byStage) {
        byStage = new Map()
        expandedStageLayouts.set(taskId, byStage)
      }
      byStage.set(layout.row.stage.id, { y: layout.y, h: layout.h })
    }

    const shiftLayers = rowLayouts
      .map((layout) => {
        if (layout.row.kind === 'task') {
          const task = layout.row.task
          return (
            <g key={`shifts-task-${task.id}`}>
              {renderDateShiftArrow(task, layout.y)}
            </g>
          )
        }
        if (layout.row.kind === 'stage') {
          const { task, stage } = layout.row
          return (
            <g key={`shifts-stage-${stage.id}`}>
              {renderStageDateShiftArrow(task, layout.y, layout.h, stage.id)}
            </g>
          )
        }
        return null
      })
      .filter(Boolean)

    const depLayers = [...expandedStageLayouts.entries()].map(([taskId, stageLayoutById]) => {
      const task = effectiveById.get(taskId)
      if (!task) return null
      return (
        <g key={`stage-deps-${taskId}`}>
          {renderExpandedStageDependencyArrows(task, stageLayoutById)}
        </g>
      )
    })

    return (
      <>
        {shiftLayers}
        {depLayers}
      </>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowLayouts, pendingTasks, savedTaskShifts, savedStageShifts, savedMilestoneShifts, dragPreview, drag, minDate, dayWidth, activeShiftCommentKey, showShiftComments, pendingMilestones, effectiveById, ganttExpandedTaskIds])

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
          <marker id="arrow-stage-dep" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#6366f1" />
          </marker>
        </defs>
        <rect x={0} y={0} width={LABEL_W + chartW} height={HEADER_H} fill="#f8fafc" />
        {monthLabels.map((m, i) => (
          <text key={i} x={m.x} y={28} className="gantt-month-label">
            {m.text}
          </text>
        ))}

        {rowLayouts.map((layout) => {
          const { y, h, row, index: i } = layout

          if (row.kind === 'lane') {
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
                onClick={() => toggleGroupCollapsed(row.groupKey)}
              >
                <rect x={0} y={y} width={LABEL_W + chartW} height={h} fill="#e2e8f0" />
                <rect x={0} y={y} width={4} height={h} fill={laneColor} />
                <text x={16} y={y + 26} className="lane-label">
                  {collapsed ? '▸' : '▾'} {row.laneLabel}
                  <tspan className="lane-count"> ({row.taskCount ?? 0})</tspan>
                  {dateLabel && <tspan className="lane-dates"> · {dateLabel}</tspan>}
                </text>
                {collapsed && showIndicative && ranges?.indicative && (
                  <rect
                    x={xForDate(ranges.indicative.start)}
                    y={y + 10}
                    width={ganttBarWidthPx(ranges.indicative.start, ranges.indicative.end, dayWidth, 4)}
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
                    width={ganttBarWidthPx(ranges.actual.start, ranges.actual.end, dayWidth, 6)}
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

          if (row.kind === 'stage') {
            const { task, stage, stageIndex } = row
            const range = getStageBarRange(stage)
            const stageNum = stageDisplayNumber(stageIndex)
            const barRange = range ? indicativeBarDates(range.start, range.end) : null

            return (
              <g key={`stage-${stage.id}`} className="gantt-stage-row">
                <rect x={0} y={y} width={LABEL_W + chartW} height={h} fill="#f8fafc" />
                <rect x={0} y={y} width={3} height={h} fill="#c7d2fe" />
                <text
                  x={28}
                  y={y + 20}
                  className="gantt-stage-label"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  {ru.gantt.stageRowLabel(stageNum, stage.name)}
                </text>
                {barRange && (
                  <rect
                    x={xForDate(barRange.start)}
                    y={y + GANTT_STAGE_ROW_BAR_TOP}
                    width={ganttBarWidthPx(barRange.start, barRange.end, dayWidth, 4)}
                    height={STAGE_BAR_H}
                    fill={stage.is_done ? '#16a34a' : '#6366f133'}
                    fillOpacity={stage.is_done ? 0.9 : 1}
                    stroke={stage.is_done ? '#15803d' : '#6366f1'}
                    strokeWidth={1}
                    strokeDasharray={stage.is_indicative ? '3 2' : undefined}
                    rx={2}
                    className="gantt-bar-stage"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <title>
                      {stage.is_done
                        ? ru.gantt.stageCompleted(
                            stage.name,
                            fmtDate(barRange.start),
                            fmtDate(barRange.end)
                          )
                        : `${stageNum}. ${stage.name}`}
                    </title>
                  </rect>
                )}
              </g>
            )
          }

          const task = row.task
          const effective = effectiveById.get(task.id) ?? task
          const catColor = row.category?.color || '#94a3b8'
          const { start, end, pending } = getTaskDates(task)
          const indStart = parseDate(effective.indicative_start)
          const indEnd = parseDate(effective.indicative_end)
          const done = effective.completion_pct >= 100
          const pColor = priorityColor(effective.priority)
          const labelX = ganttShowPriority ? 34 : 8
          const hasStages = taskHasGanttStages(effective)
          const stagesExpanded = isGanttTaskExpanded(task.id)
          const nameX = hasStages ? labelX + 14 : labelX

          const indRange = showIndicative ? indicativeBarDates(indStart, indEnd) : null

          return (
            <g key={task.id}>
              <rect x={0} y={y} width={LABEL_W + chartW} height={h} fill={i % 2 ? '#fff' : '#fafafa'} />
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
              {hasStages && (
                <text
                  x={labelX}
                  y={y + 26}
                  className="gantt-expand-toggle"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleGanttTaskExpanded(task.id)
                  }}
                >
                  <title>{stagesExpanded ? ru.gantt.collapseStages : ru.gantt.expandStages}</title>
                  {stagesExpanded ? '▾' : '▸'}
                </text>
              )}
              <text
                x={nameX}
                y={y + 26}
                className={`task-label ${done ? 'done' : ''}`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                {done ? '✓ ' : ''}
                {effective.name}
                {pending ? ' *' : ''}
              </text>
              {indRange && (
                <rect
                  x={xForDate(indRange.start)}
                  y={y + 10}
                  width={ganttBarWidthPx(indRange.start, indRange.end, dayWidth, 4)}
                  height={24}
                  fill={catColor + '22'}
                  stroke={catColor}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  rx={4}
                  className="gantt-bar-indicative"
                />
              )}
              {hasStages &&
                !stagesExpanded &&
                sortedSubStages(effective.sub_stages ?? []).map((stage, stageIndex) => {
                  const range = getStageBarRange(stage)
                  if (!range) return null
                  const barRange = indicativeBarDates(range.start, range.end)
                  if (!barRange) return null
                  return (
                    <rect
                      key={`collapsed-stage-${stage.id}`}
                      x={xForDate(barRange.start)}
                      y={y + STAGE_BAR_TOP}
                      width={ganttBarWidthPx(barRange.start, barRange.end, dayWidth, 3)}
                      height={STAGE_BAR_H}
                      fill={stage.is_done ? '#16a34a' : '#6366f133'}
                      fillOpacity={stage.is_done ? 0.9 : 1}
                      stroke={stage.is_done ? '#15803d' : '#6366f1'}
                      strokeWidth={1}
                      strokeDasharray={stage.is_indicative ? '3 2' : undefined}
                      rx={2}
                      className="gantt-bar-stage-collapsed"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <title>
                        {stage.is_done
                          ? ru.gantt.stageCompleted(
                              stage.name,
                              fmtDate(barRange.start),
                              fmtDate(barRange.end)
                            )
                          : ru.gantt.stageRowLabel(stageDisplayNumber(stageIndex), stage.name)}
                      </title>
                    </rect>
                  )
                })}
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
                    width={Math.max(
                      ganttBarWidthPx(start, end, dayWidth, 6) - (ganttShowPriority ? 4 : 0),
                      6
                    )}
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
                    width={ganttBarWidthPx(start, end, dayWidth, 6) * (effective.completion_pct / 100)}
                    height={16}
                    fill="#ffffff55"
                    rx={3}
                    style={{ pointerEvents: 'none' }}
                  />
                  <rect
                    x={ganttBarEndX(start, end, dayWidth, xForDate, 6) - 4}
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
              stroke={d.stageLevel ? '#6366f1' : '#64748b'}
              strokeWidth={d.stageLevel ? 2 : 1.5}
              strokeDasharray={d.stageLevel ? '5 3' : undefined}
              markerEnd={d.stageLevel ? 'url(#arrow-stage-dep)' : 'url(#arrow)'}
            >
              <title>{d.title}</title>
            </path>
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
