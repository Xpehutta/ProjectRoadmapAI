import { useMemo } from 'react'
import { DateShiftIndicator } from './DateShiftIndicator'
import { PendingShiftComment } from './PendingShiftComment'
import { useEffectiveTasks, usePendingTaskIds } from '../hooks/useEffectiveTasks'
import { useTaskDateShifts } from '../hooks/useTaskDateShift'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useUIStore } from '../stores/uiStore'
import type { ProjectDetail, Task } from '../types'
import { formatTaskSchedule, isIndicativeSchedule } from '../utils/taskDisplay'
import { ScheduleBar } from './ScheduleBar'
import { buildTaskGroups, formatGroupDateRange, getGroupDateRangesFromTasks } from '../utils/taskGroups'
import { ru } from '../locale/ru'

interface Props {
  project: ProjectDetail
}

function TimelineItem({
  task,
  baseTask,
  project,
  color,
  done,
  pending,
  showIndicative,
  onSelect,
  onUpdateDate,
}: {
  task: Task
  baseTask: Task
  project: ProjectDetail
  color: string
  done: boolean
  pending: boolean
  showIndicative: boolean
  onSelect: () => void
  onUpdateDate: (task: Task, field: 'start_date' | 'end_date', value: string) => void
}) {
  const dateShifts = useTaskDateShifts(baseTask)
  const cat = task.category_id ? project.categories.find((c) => c.id === task.category_id) : null
  const borderColor = cat?.color || color

  return (
    <div className={`timeline-item ${done ? 'done' : ''} ${pending ? 'pending' : ''}`}>
      <div className="timeline-date-editable" onClick={(e) => e.stopPropagation()}>
        <input
          type="date"
          className="timeline-date-input"
          key={`ts-${task.id}-${task.start_date}`}
          defaultValue={task.start_date ?? ''}
          onBlur={(e) => onUpdateDate(baseTask, 'start_date', e.target.value)}
        />
        <span>→</span>
        <input
          type="date"
          className="timeline-date-input"
          key={`te-${task.id}-${task.end_date}`}
          defaultValue={task.end_date ?? ''}
          onBlur={(e) => onUpdateDate(baseTask, 'end_date', e.target.value)}
        />
        <DateShiftIndicator
          shifts={dateShifts}
          entityKey={`task-${baseTask.id}`}
          entityLabel={baseTask.name}
        />
        <PendingShiftComment taskId={baseTask.id} taskName={baseTask.name} />
        {pending && !dateShifts.length && <span className="pending-star">*</span>}
        {(() => {
          const schedule = formatTaskSchedule(task, showIndicative)
          if (!schedule) return null
          const indicative = isIndicativeSchedule(task) && !task.end_date
          return (
            <div className={`timeline-schedule-hint ${indicative ? 'indicative' : ''}`}>{schedule}</div>
          )
        })()}
      </div>
      <div className="timeline-card" style={{ borderColor }} onClick={onSelect}>
        <div className="timeline-card-header">
          <span>
            {done ? '✓ ' : ''}
            {task.name}
          </span>
          <span className="pct">{task.completion_pct}%</span>
        </div>
        {showIndicative && (task.indicative_start || task.indicative_end) && (
          <div className="indicative-sub">
            {ru.timeline.indicative}: {task.indicative_start ?? '…'} → {task.indicative_end ?? '…'}
          </div>
        )}
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${task.completion_pct}%`, background: borderColor }}
          />
        </div>
        {task.assignee && <div className="assignee">{task.assignee}</div>}
        <ScheduleBar
          task={task}
          color={borderColor}
          showIndicative={showIndicative}
          className="timeline-schedule-bar"
        />
      </div>
    </div>
  )
}

export function TimelineView({ project }: Props) {
  const showIndicative = useUIStore((s) => s.showIndicative)
  const groupingMode = useUIStore((s) => s.groupingMode)
  const collapsedGroupKeys = useUIStore((s) => s.collapsedGroupKeys)
  const toggleGroupCollapsed = useUIStore((s) => s.toggleGroupCollapsed)
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const stageTaskChange = usePendingChangesStore((s) => s.stageTaskChange)
  const effectiveTasks = useEffectiveTasks(project.tasks)
  const pendingIds = usePendingTaskIds(project.tasks)

  const taskById = useMemo(() => new Map(project.tasks.map((t) => [t.id, t])), [project.tasks])
  const effectiveById = useMemo(() => new Map(effectiveTasks.map((t) => [t.id, t])), [effectiveTasks])

  const isPending = (taskId: number) => pendingIds.has(taskId)

  const sections = useMemo(() => {
    const sortKey = (t: Task) => t.start_date || ''
    const groups = buildTaskGroups(effectiveTasks, project.categories, groupingMode)
    return groups.map((g) => ({
      key: g.key,
      title: g.label,
      color: g.color || '#64748b',
      tasks: [...g.tasks].sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    }))
  }, [project, groupingMode, effectiveTasks])

  const milestones = [...project.milestones].sort((a, b) => a.date.localeCompare(b.date))

  const updateDate = (task: Task, field: 'start_date' | 'end_date', value: string) => {
    const base = taskById.get(task.id) ?? task
    const effective = effectiveById.get(task.id) ?? task
    stageTaskChange(base, {
      start_date: field === 'start_date' ? value || null : effective.start_date,
      end_date: field === 'end_date' ? value || null : effective.end_date,
    })
  }

  return (
    <div className="timeline-view">
      <section className="timeline-milestones">
        <h3>{ru.timeline.milestones}</h3>
        <div className="milestone-strip">
          {milestones.map((m) => (
            <div key={m.id} className="milestone-chip">
              <span className="diamond">◆</span>
              <strong>{m.date}</strong> {m.name}
            </div>
          ))}
        </div>
      </section>

      {sections.map((section) => {
        const isSwimlane = groupingMode === 'swimlane'
        const collapsed = isSwimlane && collapsedGroupKeys.includes(section.key)
        const groupRanges = collapsed ? getGroupDateRangesFromTasks(section.tasks) : null
        return (
          <section key={section.key} className="timeline-section">
            <h3
              style={{ borderLeftColor: section.color }}
              className={isSwimlane ? 'timeline-group-header clickable' : undefined}
              onClick={isSwimlane ? () => toggleGroupCollapsed(section.key) : undefined}
            >
              {isSwimlane ? (collapsed ? '▸' : '▾') + ' ' : ''}
              {section.title}
              {isSwimlane ? ` (${section.tasks.length})` : ''}
              {groupRanges?.actual && (
                <span className="timeline-group-dates timeline-group-dates-actual">
                  {' '}
                  · {ru.table.groupActual} {formatGroupDateRange(groupRanges.actual)}
                </span>
              )}
              {groupRanges?.indicative && (
                <span className="timeline-group-dates timeline-group-dates-indicative">
                  {' '}
                  · {ru.table.groupIndicative} {formatGroupDateRange(groupRanges.indicative)}
                </span>
              )}
            </h3>
            {!collapsed && (
              <div className="timeline-track">
                {section.tasks.map((task) => (
                  <TimelineItem
                    key={task.id}
                    task={task}
                    baseTask={taskById.get(task.id) ?? task}
                    project={project}
                    color={section.color}
                    done={task.completion_pct >= 100}
                    pending={isPending(task.id)}
                    showIndicative={showIndicative}
                    onSelect={() => setSelectedTaskId(task.id)}
                    onUpdateDate={updateDate}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
