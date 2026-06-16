import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useMemo } from 'react'
import { useEffectiveTasks, usePendingTaskIds } from '../hooks/useEffectiveTasks'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useUIStore } from '../stores/uiStore'
import type { ProjectDetail, Release, Task } from '../types'
import { applyPendingToTask } from '../utils/taskPending'
import { formatScore, prioritizationScore } from '../utils/scoring'
import { ru } from '../locale/ru'

interface Props {
  project: ProjectDetail
}

const UNASSIGNED_ID = 'unassigned'

function ReleaseCard({
  task,
  releaseColor,
  pending,
  scoreLabel,
  onSelect,
}: {
  task: Task
  releaseColor: string
  pending: boolean
  scoreLabel: string
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(task.id),
  })
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.8 : 1 }
    : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div
        className={`release-card ${pending ? 'pending' : ''}`}
        style={{ borderLeftColor: releaseColor }}
        onClick={onSelect}
      >
        <div className="release-card-title">
          {task.name}
          {pending ? ' *' : ''}
        </div>
        <div className="release-card-meta">
          <span className="score-badge has-score">{scoreLabel}</span>
          <span>{task.completion_pct}%</span>
        </div>
      </div>
    </div>
  )
}

function ReleaseColumn({
  columnId,
  release,
  tasks,
  pendingIds,
  scoreLabel,
  onSelect,
}: {
  columnId: string
  release: Release | null
  tasks: Task[]
  pendingIds: Set<number>
  scoreLabel: (t: Task) => string
  onSelect: (id: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId })
  const color = release?.color ?? '#94a3b8'

  return (
    <div className={`release-column ${isOver ? 'over' : ''}`} ref={setNodeRef}>
      <header className="release-column-header" style={{ borderTopColor: color }}>
        <h3>{release?.name ?? ru.releases.unassigned}</h3>
        <span className="count">{tasks.length}</span>
        {release && (
          <div className="release-column-meta">
            <span className={`release-status release-status-${release.status}`}>
              {ru.releases.status[release.status]}
            </span>
            {release.target_date && <span className="release-date">{release.target_date}</span>}
          </div>
        )}
      </header>
      <div className="release-cards">
        {tasks.map((task) => (
          <ReleaseCard
            key={task.id}
            task={task}
            releaseColor={color}
            pending={pendingIds.has(task.id)}
            scoreLabel={scoreLabel(task)}
            onSelect={() => onSelect(task.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function ReleaseBoardView({ project }: Props) {
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const method = useUIStore((s) => s.prioritizationMethod)
  const stageTaskChange = usePendingChangesStore((s) => s.stageTaskChange)
  const taskChanges = usePendingChangesStore((s) => s.taskChanges)
  const effectiveTasks = useEffectiveTasks(project.tasks)
  const pendingIds = usePendingTaskIds(project.tasks)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const columns = useMemo(() => {
    const unassigned: Task[] = []
    const byRelease = new Map<number, Task[]>()
    for (const r of project.releases) byRelease.set(r.id, [])
    for (const t of effectiveTasks) {
      if (t.release_id == null) unassigned.push(t)
      else byRelease.get(t.release_id)?.push(t)
    }
    const score = (t: Task) => formatScore(prioritizationScore(t, method), method)
    const sortTasks = (list: Task[]) =>
      [...list].sort((a, b) => {
        const sa = prioritizationScore(a, method) ?? -1
        const sb = prioritizationScore(b, method) ?? -1
        return sb - sa
      })
    return {
      unassigned: sortTasks(unassigned),
      byRelease,
      scoreLabel: score,
    }
  }, [effectiveTasks, project.releases, method])

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const taskId = Number(active.id)
    const task = project.tasks.find((t) => t.id === taskId)
    if (!task) return
    const columnId = String(over.id)
    const newReleaseId = columnId === UNASSIGNED_ID ? null : Number(columnId)
    const current = applyPendingToTask(task, taskChanges[taskId]?.patch)
    if (current.release_id === newReleaseId) return
    stageTaskChange(task, { release_id: newReleaseId })
  }

  return (
    <div className="release-board-view">
      <p className="muted release-board-hint">{ru.releaseBoard.hint}</p>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="release-board">
          <ReleaseColumn
            columnId={UNASSIGNED_ID}
            release={null}
            tasks={columns.unassigned}
            pendingIds={pendingIds}
            scoreLabel={columns.scoreLabel}
            onSelect={setSelectedTaskId}
          />
          {project.releases.map((release) => (
            <ReleaseColumn
              key={release.id}
              columnId={String(release.id)}
              release={release}
              tasks={columns.byRelease.get(release.id) ?? []}
              pendingIds={pendingIds}
              scoreLabel={columns.scoreLabel}
              onSelect={setSelectedTaskId}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
