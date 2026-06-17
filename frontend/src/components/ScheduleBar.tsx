import { useMemo } from 'react'
import type { Task } from '../types'
import { computeScheduleBarLayout } from '../utils/scheduleBar'

interface Props {
  task: Task
  color: string
  showIndicative?: boolean
  className?: string
  height?: number
}

export function ScheduleBar({
  task,
  color,
  showIndicative = true,
  className,
  height = 10,
}: Props) {
  const layout = useMemo(
    () => computeScheduleBarLayout(task, showIndicative),
    [task, showIndicative]
  )

  if (!layout.hasAny) return null

  return (
    <div
      className={`schedule-bar ${className ?? ''}`}
      style={{ height }}
      title={
        showIndicative && task.indicative_start
          ? `${task.indicative_start}${task.indicative_end ? ` – ${task.indicative_end}` : ''}`
          : undefined
      }
    >
      {layout.indicative && (
        <div
          className="schedule-bar-indicative"
          style={{
            left: `${layout.indicative.left}%`,
            width: `${layout.indicative.width}%`,
            borderColor: color,
            backgroundColor: `${color}18`,
          }}
        />
      )}
      {layout.actual && (
        <div
          className="schedule-bar-actual"
          style={{
            left: `${layout.actual.left}%`,
            width: `${layout.actual.width}%`,
            backgroundColor: color,
          }}
        />
      )}
    </div>
  )
}
