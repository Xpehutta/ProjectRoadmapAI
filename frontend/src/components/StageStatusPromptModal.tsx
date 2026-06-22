import { useState } from 'react'
import type { TaskStatus } from '../types'
import { ru, STATUS_OPTIONS } from '../locale/ru'

interface Props {
  taskName: string
  stageNames: string[]
  currentStatus: TaskStatus
  onConfirm: (status: TaskStatus, comment: string | null) => void
  onDismiss: () => void
}

export function StageStatusPromptModal({
  taskName,
  stageNames,
  currentStatus,
  onConfirm,
  onDismiss,
}: Props) {
  const [status, setStatus] = useState<TaskStatus>('in_progress')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (status !== 'in_progress' && !comment.trim()) {
      setError(ru.stageStatusPrompt.commentRequired)
      return
    }
    setError(null)
    onConfirm(status, status === 'in_progress' ? null : comment.trim())
  }

  const stagesLabel =
    stageNames.length === 1
      ? ru.stageStatusPrompt.singleStage(stageNames[0]!)
      : ru.stageStatusPrompt.multipleStages(stageNames)

  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal stage-status-prompt-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.stageStatusPrompt.title}</h2>
        <p>{ru.stageStatusPrompt.message(taskName, stagesLabel)}</p>
        <p className="muted">
          {ru.stageStatusPrompt.currentStatus}:{' '}
          <strong>{ru.status[currentStatus]}</strong>
        </p>

        <label>
          {ru.stageStatusPrompt.statusLabel}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TaskStatus)
              if (error) setError(null)
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {status !== 'in_progress' && (
          <label>
            {ru.stageStatusPrompt.comment}
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value)
                if (error) setError(null)
              }}
              placeholder={ru.stageStatusPrompt.commentPlaceholder}
              rows={3}
              autoFocus
            />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions stage-status-prompt-actions">
          <button type="button" onClick={submit}>
            {ru.stageStatusPrompt.confirm}
          </button>
          <button type="button" className="btn-secondary" onClick={onDismiss}>
            {ru.stageStatusPrompt.dismiss}
          </button>
        </div>
      </div>
    </div>
  )
}
