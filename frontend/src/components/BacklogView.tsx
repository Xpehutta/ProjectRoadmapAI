import { useMemo } from 'react'
import { useEffectiveTasks, usePendingTaskIds } from '../hooks/useEffectiveTasks'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useUIStore } from '../stores/uiStore'
import type { Moscow, ProjectDetail, Task } from '../types'
import {
  formatScore,
  MOSCOW_OPTIONS,
  PRIORITIZATION_METHODS,
  prioritizationScore,
  sortByPrioritization,
} from '../utils/scoring'
import { ru, STATUS_OPTIONS } from '../locale/ru'

interface Props {
  project: ProjectDetail
}

function numInput(
  task: Task,
  field: keyof Task,
  stage: (field: string, value: unknown) => void,
  min = 1,
  max = 100
) {
  const value = task[field] as number | null
  return (
    <input
      type="number"
      className="cell-input narrow"
      min={min}
      max={max}
      defaultValue={value ?? ''}
      onBlur={(e) => stage(field, e.target.value ? Number(e.target.value) : null)}
    />
  )
}

export function BacklogView({ project }: Props) {
  const method = useUIStore((s) => s.prioritizationMethod)
  const setMethod = useUIStore((s) => s.setPrioritizationMethod)
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const stageTaskChange = usePendingChangesStore((s) => s.stageTaskChange)
  const effectiveTasks = useEffectiveTasks(project.tasks)
  const pendingIds = usePendingTaskIds(project.tasks)

  const sorted = useMemo(
    () => sortByPrioritization(effectiveTasks, method),
    [effectiveTasks, method]
  )

  const categoryName = (id: number | null) =>
    id ? project.categories.find((c) => c.id === id)?.name ?? '—' : ru.groups.uncategorized

  return (
    <div className="backlog-view table-view">
      <div className="backlog-toolbar">
        <span className="backlog-method-label">{ru.backlog.methodTitle}:</span>
        <div className="filter-chips">
          {PRIORITIZATION_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              className={`filter-chip ${method === m ? 'active' : ''}`}
              onClick={() => setMethod(m)}
            >
              {ru.backlog.methods[m]}
            </button>
          ))}
        </div>
        <span className="muted">{ru.backlog.hint}</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{ru.table.newTask}</th>
              <th>{ru.backlog.score}</th>
              {method === 'rice' && (
                <>
                  <th>{ru.backlog.reach}</th>
                  <th>{ru.backlog.impact}</th>
                  <th>{ru.backlog.confidence}</th>
                  <th>{ru.backlog.effort}</th>
                </>
              )}
              {method === 'value_effort' && (
                <>
                  <th>{ru.backlog.value}</th>
                  <th>{ru.backlog.effort}</th>
                </>
              )}
              {method === 'moscow' && <th>{ru.backlog.moscow}</th>}
              <th>{ru.backlog.release}</th>
              <th>{ru.backlog.goal}</th>
              <th>{ru.backlog.category}</th>
              <th>{ru.backlog.status}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task, index) => {
              const base = project.tasks.find((t) => t.id === task.id) ?? task
              const pending = pendingIds.has(task.id)
              const stage = (field: string, value: unknown) => stageTaskChange(base, { [field]: value })
              const score = prioritizationScore(task, method)

              return (
                <tr
                  key={task.id}
                  className={`backlog-row ${pending ? 'pending' : ''}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <td className="rank-cell">{index + 1}</td>
                  <td>
                    <span className="backlog-task-name">
                      {task.name}
                      {pending ? ' *' : ''}
                    </span>
                  </td>
                  <td className="score-cell">
                    <span className={`score-badge ${score != null ? 'has-score' : ''}`}>
                      {formatScore(score, method)}
                    </span>
                  </td>
                  {method === 'rice' && (
                    <>
                      <td onClick={(e) => e.stopPropagation()}>{numInput(task, 'rice_reach', stage)}</td>
                      <td onClick={(e) => e.stopPropagation()}>{numInput(task, 'rice_impact', stage, 1, 10)}</td>
                      <td onClick={(e) => e.stopPropagation()}>{numInput(task, 'rice_confidence', stage, 1, 100)}</td>
                      <td onClick={(e) => e.stopPropagation()}>{numInput(task, 'rice_effort', stage)}</td>
                    </>
                  )}
                  {method === 'value_effort' && (
                    <>
                      <td onClick={(e) => e.stopPropagation()}>{numInput(task, 'value_score', stage, 1, 10)}</td>
                      <td onClick={(e) => e.stopPropagation()}>{numInput(task, 'effort_score', stage, 1, 10)}</td>
                    </>
                  )}
                  {method === 'moscow' && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="cell-input"
                        defaultValue={task.moscow ?? ''}
                        onChange={(e) =>
                          stage('moscow', (e.target.value || null) as Moscow | null)
                        }
                      >
                        <option value="">—</option>
                        {MOSCOW_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {ru.backlog.moscowLabels[m]}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className="cell-input"
                      defaultValue={task.release_id ?? ''}
                      onChange={(e) =>
                        stage('release_id', e.target.value ? Number(e.target.value) : null)
                      }
                    >
                      <option value="">{ru.releases.unassigned}</option>
                      {project.releases.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className="cell-input"
                      defaultValue={task.goal_id ?? ''}
                      onChange={(e) =>
                        stage('goal_id', e.target.value ? Number(e.target.value) : null)
                      }
                    >
                      <option value="">{ru.goals.none}</option>
                      {project.goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="muted">{categoryName(task.category_id)}</td>
                  <td>{STATUS_OPTIONS.find((s) => s.id === task.status)?.label}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
