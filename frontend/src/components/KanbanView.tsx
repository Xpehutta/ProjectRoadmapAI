import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useMemo } from 'react'
import { DateShiftIndicator } from './DateShiftIndicator'
import { useEffectiveTasks, usePendingTaskIds } from '../hooks/useEffectiveTasks'
import { useTaskDateShifts } from '../hooks/useTaskDateShift'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useUIStore } from '../stores/uiStore'
import type { ProjectDetail, Task, TaskStatus } from '../types'
import { formatTaskSchedule, isIndicativeSchedule } from '../utils/taskDisplay'
import { ScheduleBar } from './ScheduleBar'
import { applyPendingToTask } from '../utils/taskPending'
import { ru, STATUS_OPTIONS } from '../locale/ru'

const COLUMNS = STATUS_OPTIONS.map((s) => ({ id: s.id, title: s.label }))

interface Props {
  project: ProjectDetail
}

function DraggableCard({
  task,
  baseTask,
  color,
  showIndicative,
  pending,
  onSelect,
}: {
  task: Task
  baseTask: Task
  color: string
  showIndicative: boolean
  pending: boolean
  onSelect: () => void
}) {
  const dateShifts = useTaskDateShifts(baseTask)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(task.id),
  })
  const done = task.completion_pct >= 100
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.8 : 1 }
    : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div
        className={`kanban-card ${done ? 'done' : ''} ${pending ? 'pending' : ''}`}
        style={{ borderLeftColor: color }}
        onClick={onSelect}
      >
        <div className="kanban-card-title">
          {done && <span className="check">✓</span>}
          {task.name}
          {pending ? ' *' : ''}
        </div>
        <div className="kanban-meta">
          <span>{task.assignee || ru.kanban.unassigned}</span>
          <span>{task.completion_pct}%</span>
        </div>
        {(() => {
          const schedule = formatTaskSchedule(task, showIndicative)
          if (!schedule) return null
          const indicative = isIndicativeSchedule(task) && !task.end_date
          return (
            <div className={`kanban-dates ${indicative ? 'kanban-dates-indicative' : ''}`}>
              {schedule}
              <DateShiftIndicator
                shifts={dateShifts}
                entityKey={`task-${baseTask.id}`}
                entityLabel={baseTask.name}
                compact
              />
            </div>
          )
        })()}
        <ScheduleBar
          task={task}
          color={color}
          showIndicative={showIndicative}
          className="kanban-schedule-bar"
        />
        <div className="progress-bar small">
          <div
            className="progress-fill"
            style={{ width: `${task.completion_pct}%`, background: color }}
          />
        </div>
      </div>
    </div>
  )
}

function DroppableColumn({
  id,
  title,
  tasks,
  baseTasksById,
  pendingIds,
  catColor,
  showIndicative,
  onSelect,
}: {
  id: TaskStatus
  title: string
  tasks: Task[]
  baseTasksById: Map<number, Task>
  pendingIds: Set<number>
  catColor: (t: Task) => string
  showIndicative: boolean
  onSelect: (id: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div className={`kanban-column ${isOver ? 'over' : ''}`} ref={setNodeRef}>
      <h3>
        {title}
        <span className="count">{tasks.length}</span>
      </h3>
      <div className="kanban-cards">
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            baseTask={baseTasksById.get(task.id) ?? task}
            color={catColor(task)}
            showIndicative={showIndicative}
            pending={pendingIds.has(task.id)}
            onSelect={() => onSelect(task.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function KanbanView({ project }: Props) {
  const showIndicative = useUIStore((s) => s.showIndicative)
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const stageTaskChange = usePendingChangesStore((s) => s.stageTaskChange)
  const taskChanges = usePendingChangesStore((s) => s.taskChanges)
  const effectiveTasks = useEffectiveTasks(project.tasks)
  const pendingIds = usePendingTaskIds(project.tasks)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const baseTasksById = useMemo(() => new Map(project.tasks.map((t) => [t.id, t])), [project.tasks])

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
      blocked: [],
    }
    for (const t of effectiveTasks) map[t.status].push(t)
    return map
  }, [effectiveTasks])

  const upcoming = [...project.milestones]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const taskId = Number(active.id)
    const newStatus = over.id as TaskStatus
    if (!COLUMNS.find((c) => c.id === newStatus)) return
    const task = project.tasks.find((t) => t.id === taskId)
    if (!task) return
    const current = applyPendingToTask(task, taskChanges[taskId]?.patch)
    if (current.status === newStatus) return
    stageTaskChange(task, { status: newStatus })
  }

  const catColor = (task: Task) =>
    project.categories.find((c) => c.id === task.category_id)?.color || '#94a3b8'

  return (
    <div className="kanban-view">
      <div className="kanban-milestones">
        <strong>Upcoming milestones:</strong>
        {upcoming.map((m) => (
          <span key={m.id} className="milestone-chip small">
            ◆ {m.date} {m.name}
          </span>
        ))}
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="kanban-board">
          {COLUMNS.map((col) => (
            <DroppableColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={byStatus[col.id]}
              baseTasksById={baseTasksById}
              pendingIds={pendingIds}
              catColor={catColor}
              showIndicative={showIndicative}
              onSelect={setSelectedTaskId}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
