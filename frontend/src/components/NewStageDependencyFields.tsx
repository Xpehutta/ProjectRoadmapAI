import type { DependencyType, SubStage, Task } from '../types'
import { ru } from '../locale/ru'
import { InternalStagePredecessorPicker } from './InternalStagePredecessorPicker'
import { stageOptions, type TaskDependencyDraft } from '../utils/taskDependencyRefs'

const DEP_TYPES: DependencyType[] = ['FS', 'SS', 'FF', 'SF']

interface Props {
  stageName: string
  stageNumber: number
  existingStages: SubStage[]
  tasks: Task[]
  currentTaskId: number
  crossTaskValue: TaskDependencyDraft | null
  onCrossTaskChange: (value: TaskDependencyDraft | null) => void
  internalPredStageIds: number[]
  onInternalPredChange: (stageIds: number[]) => void
}

function emptyDraft(predecessorId: number, stageNumber: number): TaskDependencyDraft {
  return {
    predecessorId,
    type: 'FS',
    predecessorStageNumber: null,
    successorStageNumber: stageNumber,
  }
}

export function NewStageDependencyFields({
  stageName,
  stageNumber,
  existingStages,
  tasks,
  currentTaskId,
  crossTaskValue,
  onCrossTaskChange,
  internalPredStageIds,
  onInternalPredChange,
}: Props) {
  const otherTasks = tasks.filter((t) => t.id !== currentTaskId)
  const crossTaskEnabled = crossTaskValue !== null
  const crossTaskDraft = crossTaskValue ?? emptyDraft(otherTasks[0]?.id ?? 0, stageNumber)
  const predTask = tasks.find((t) => t.id === crossTaskDraft.predecessorId)
  const predStageOptions = predTask ? stageOptions(predTask.sub_stages ?? []) : []
  const successorLabel = `${stageNumber}. ${stageName.trim() || ru.drawer.newStageDependencyPendingName}`

  const updateCrossTask = (patch: Partial<TaskDependencyDraft>) => {
    onCrossTaskChange({ ...crossTaskDraft, ...patch, successorStageNumber: stageNumber })
  }

  return (
    <>
      {existingStages.length > 0 && (
        <label className="stage-predecessor-select-field">
          <span>{ru.drawer.newStageInternalPredecessors}</span>
          <InternalStagePredecessorPicker
            stages={existingStages}
            selectedIds={internalPredStageIds}
            onChange={onInternalPredChange}
            variant="select"
          />
        </label>
      )}

      <div className="new-stage-dependency-fields">
        <label className="toggle inline-toggle new-stage-dependency-toggle">
          <input
            type="checkbox"
            checked={crossTaskEnabled}
            disabled={!otherTasks.length}
            onChange={(e) => {
              if (e.target.checked) {
                onCrossTaskChange(emptyDraft(otherTasks[0].id, stageNumber))
              } else {
                onCrossTaskChange(null)
              }
            }}
          />
          {ru.drawer.newStageDependencyEnable}
        </label>
        {!otherTasks.length && (
          <p className="muted new-stage-dependency-empty">{ru.drawer.newStageDependencyNoTasks}</p>
        )}
        {crossTaskEnabled && (
          <>
            <p className="muted new-stage-dependency-hint">{ru.drawer.newStageDependencyHint}</p>
            <div className="new-stage-dependency-grid">
              <label>
                {ru.drawer.taskDependencyPredecessor}
                <select
                  value={crossTaskDraft.predecessorId || ''}
                  onChange={(e) =>
                    updateCrossTask({
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
                    value={crossTaskDraft.predecessorStageNumber ?? ''}
                    onChange={(e) =>
                      updateCrossTask({
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

              <label>
                {ru.drawer.taskDependencySuccStage}
                <input type="text" readOnly className="readonly-field" value={successorLabel} />
              </label>

              <label>
                {ru.drawer.taskDependencyType}
                <select
                  value={crossTaskDraft.type}
                  onChange={(e) => updateCrossTask({ type: e.target.value as DependencyType })}
                >
                  {DEP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
      </div>
    </>
  )
}
