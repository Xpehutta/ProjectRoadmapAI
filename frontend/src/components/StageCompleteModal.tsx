import { useState } from 'react'
import type { SubStage } from '../types'
import { ru } from '../locale/ru'
import { stageDatesChanged, stagePlannedDates } from '../utils/stageComplete'

interface Props {
  stage: SubStage
  onCancel: () => void
  onConfirm: (data: {
    start_date: string | null
    end_date: string | null
    comment: string
  }) => void | Promise<void>
  submitting?: boolean
}

export function StageCompleteModal({ stage, onCancel, onConfirm, submitting }: Props) {
  const planned = stagePlannedDates(stage)
  const [startDate, setStartDate] = useState(planned.start_date ?? '')
  const [endDate, setEndDate] = useState(planned.end_date ?? '')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const payload = {
    start_date: startDate || null,
    end_date: endDate || null,
    comment: comment.trim(),
  }
  const datesEdited = stageDatesChanged(stage, payload)

  const submit = async () => {
    if (datesEdited && !payload.comment) {
      setError(ru.stageComplete.commentRequired)
      return
    }
    setError(null)
    await onConfirm(payload)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal wide stage-complete-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.stageComplete.title(stage.name)}</h2>
        <p className="muted">{ru.stageComplete.subtitle}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <label>
            {ru.drawer.stageStartDate}
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            {ru.drawer.stageEndDate}
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          {datesEdited && (
            <>
              <p className="muted stage-complete-shift-hint">{ru.stageComplete.shiftHint}</p>
              <label>
                {ru.stageComplete.comment}
                <textarea
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder={ru.stageComplete.commentPlaceholder}
                  rows={3}
                />
              </label>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions stage-date-change-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
              {ru.stageComplete.cancel}
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? ru.stageComplete.submitting : ru.stageComplete.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
