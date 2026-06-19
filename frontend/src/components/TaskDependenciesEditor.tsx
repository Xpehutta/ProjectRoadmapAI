import type { DependencyType, Task } from '../types'
import { ru } from '../locale/ru'
import { stageOptions, type TaskDependencyDraft } from '../utils/taskDependencyRefs'

const DEP_TYPES: DependencyType[] = ['FS', 'SS', 'FF', 'SF']

interface Props {
  task: Task
  tasks: Task[]
  drafts: TaskDependencyDraft[]
  onChange: (drafts: TaskDependencyDraft[]) => void
  onDraftConfigured?: (draft: TaskDependencyDraft) => void
}

function emptyDraft(predecessorId: number): TaskDependencyDraft {
  return {
    predecessorId,
    type: 'FS',
    predecessorStageNumber: null,
    successorStageNumber: null,
  }
}

export function TaskDependenciesEditor({ task, tasks, drafts, onChange, onDraftConfigured }: Props) {
  const tasksById = new Map(tasks.map((t) => [t.id, t]))
  const otherTasks = tasks.filter((t) => t.id !== task.id)
  const succStageOptions = stageOptions(task.sub_stages ?? [])

  const updateDraft = (index: number, patch: Partial<TaskDependencyDraft>) => {
    const next = [...drafts]
    next[index] = { ...next[index], ...patch }
    const updated = next[index]
    onChange(next.filter((d) => d.predecessorId > 0))
    if (
      updated.predecessorId > 0 &&
      ('predecessorId' in patch ||
        'predecessorStageNumber' in patch ||
        'successorStageNumber' in patch)
    ) {
      onDraftConfigured?.(updated)
    }
  }

  const removeDraft = (index: number) => {
    onChange(drafts.filter((_, i) => i !== index))
  }

  const addDraft = () => {
    if (!otherTasks.length) return
    onChange([...drafts, emptyDraft(otherTasks[0].id)])
  }

  return (
    <div className="task-dependencies-editor">
      <div className="task-dependencies-header">
        <h4>{ru.drawer.taskDependencies}</h4>
        <p className="muted">{ru.drawer.taskDependenciesHint}</p>
      </div>

      {drafts.length === 0 && (
        <p className="muted task-dependencies-empty">{ru.drawer.taskDependenciesEmpty}</p>
      )}

      <ul className="task-dependencies-list">
        {drafts.map((draft, index) => {
          const predTask = tasksById.get(draft.predecessorId)
          const predStageOptions = predTask ? stageOptions(predTask.sub_stages ?? []) : []

          return (
            <li key={`${draft.predecessorId}-${index}`} className="task-dependency-item">
              <label>
                {ru.drawer.taskDependencyPredecessor}
                <select
                  value={draft.predecessorId || ''}
                  onChange={(e) =>
                    updateDraft(index, {
                      predecessorId: Number(e.target.value),
                      predecessorStageNumber: null,
                    })
                  }
                >
                  <option value="">{ru.drawer.taskDependencyPickTask}</option>
                  {otherTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              {predStageOptions.length > 0 && (
                <label>
                  {ru.drawer.taskDependencyPredStage}
                  <select
                    value={draft.predecessorStageNumber ?? ''}
                    onChange={(e) =>
                      updateDraft(index, {
                        predecessorStageNumber: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">{ru.drawer.taskDependencyWholeTask}</option>
                    {predStageOptions.map((opt) => (
                      <option key={opt.number} value={opt.number}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {succStageOptions.length > 0 && (
                <label>
                  {ru.drawer.taskDependencySuccStage}
                  <select
                    value={draft.successorStageNumber ?? ''}
                    onChange={(e) =>
                      updateDraft(index, {
                        successorStageNumber: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">{ru.drawer.taskDependencyWholeTask}</option>
                    {succStageOptions.map((opt) => (
                      <option key={opt.number} value={opt.number}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                {ru.drawer.taskDependencyType}
                <select
                  value={draft.type}
                  onChange={(e) => updateDraft(index, { type: e.target.value as DependencyType })}
                >
                  {DEP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <button type="button" className="link-btn" onClick={() => removeDraft(index)}>
                {ru.drawer.taskDependencyRemove}
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className="start-page-secondary inline"
        onClick={addDraft}
        disabled={!otherTasks.length}
      >
        {ru.drawer.taskDependencyAdd}
      </button>
    </div>
  )
}
