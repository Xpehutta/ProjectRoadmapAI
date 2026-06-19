import { useState } from 'react'
import { ru } from '../locale/ru'
import type { StageDeleteWarning } from '../utils/stageDeleteWarnings'

interface Props {
  stageName: string
  isDone: boolean
  warnings: StageDeleteWarning[]
  onCancel: () => void
  onConfirm: (comment: string | null) => void | Promise<void>
  deleting?: boolean
}

export function DeleteStageModal({
  stageName,
  isDone,
  warnings,
  onCancel,
  onConfirm,
  deleting,
}: Props) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = comment.trim()
    if (isDone && !trimmed) {
      setError(ru.deleteStage.commentRequired)
      return
    }
    setError(null)
    await onConfirm(isDone ? trimmed : null)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal delete-stage-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.deleteStage.title(stageName)}</h2>
        <p>{ru.deleteStage.message}</p>

        {isDone && (
          <div className="delete-stage-done-notice">
            <p className="delete-stage-done-title">{ru.deleteStage.doneTitle}</p>
            <p className="muted">{ru.deleteStage.doneHint}</p>
            <label>
              {ru.deleteStage.comment}
              <textarea
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value)
                  if (error) setError(null)
                }}
                placeholder={ru.deleteStage.commentPlaceholder}
                rows={3}
                autoFocus
              />
            </label>
            {error && <p className="form-error">{error}</p>}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="delete-stage-warnings">
            <p className="delete-stage-warnings-title">{ru.deleteStage.warningsTitle}</p>
            <ul>
              {warnings.map((w) => (
                <li key={w.message}>{w.message}</li>
              ))}
            </ul>
            <p className="muted">{ru.deleteStage.warningsNote}</p>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-danger" disabled={deleting} onClick={() => void submit()}>
            {deleting ? ru.deleteStage.deleting : ru.deleteStage.confirm}
          </button>
          <button type="button" className="btn-secondary" disabled={deleting} onClick={onCancel}>
            {ru.deleteStage.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
