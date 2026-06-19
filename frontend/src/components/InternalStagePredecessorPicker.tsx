import type { SubStage } from '../types'
import { ru } from '../locale/ru'
import { stageOptionsForInternalDeps } from '../utils/stageInternalDeps'

interface Props {
  stages: SubStage[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  compact?: boolean
  /** list = checkboxes; select = multi-select dropdown */
  variant?: 'list' | 'select'
}

export function InternalStagePredecessorPicker({
  stages,
  selectedIds,
  onChange,
  disabled,
  compact,
  variant = 'list',
}: Props) {
  const options = stageOptionsForInternalDeps(stages)
  if (!options.length) return null

  const toggle = (stageId: number) => {
    if (disabled) return
    if (selectedIds.includes(stageId)) {
      onChange(selectedIds.filter((id) => id !== stageId))
    } else {
      onChange([...selectedIds, stageId])
    }
  }

  if (variant === 'select') {
    const listSize = Math.min(Math.max(options.length, 2), 6)
    return (
      <div className="stage-predecessor-picker stage-predecessor-picker-select">
        <select
          multiple
          size={listSize}
          className="stage-predecessor-multiselect"
          disabled={disabled}
          value={selectedIds.map(String)}
          onChange={(e) => {
            const ids = Array.from(e.target.selectedOptions).map((opt) => Number(opt.value))
            onChange(ids)
          }}
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="muted stage-predecessor-picker-hint">{ru.drawer.newStageInternalPredecessorsHint}</p>
        {selectedIds.length === 0 && (
          <p className="muted stage-predecessor-picker-empty">{ru.drawer.stagePredecessorPickerEmpty}</p>
        )}
      </div>
    )
  }

  return (
    <div className={`stage-predecessor-picker${compact ? ' stage-predecessor-picker-compact' : ''}`}>
      <ul className="stage-predecessor-picker-list">
        {options.map((opt) => {
          const checked = selectedIds.includes(opt.id)
          return (
            <li key={opt.id}>
              <label className={`stage-predecessor-picker-item${checked ? ' selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            </li>
          )
        })}
      </ul>
      {selectedIds.length === 0 && (
        <p className="muted stage-predecessor-picker-empty">{ru.drawer.stagePredecessorPickerEmpty}</p>
      )}
    </div>
  )
}
