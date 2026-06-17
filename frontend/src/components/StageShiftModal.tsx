import { useState } from 'react'
import type { SubStage } from '../types'
import { ru } from '../locale/ru'
import { stageDatesChanged, stagePlannedDates } from '../utils/stageComplete'

interface Props {
  stage: SubStage
  initial?: { start_date: string | null; end_date: string | null }
  onCancel: () => void
  onConfirm: (data: {
    start_date: string | null
    end_date: string | null
    comment: string
  }) => void | Promise<void>
  submitting?: boolean
}

export function StageShiftModal({ stage, initial, onCancel, onConfirm, submitting }: Props) {
  const planned = initial ?? stagePlannedDates(stage)
  const [startDate, setStartDate] = useState(planned.start_date ?? '')
  const [endDate, setEndDate] = useState(planned.end_date ?? '')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const payload = {
    start_date: startDate || null,
    end_date: endDate || null,
    comment: comment.trim(),
  }

  const submit = async () => {
    if (!stageDatesChanged(stage, payload)) {
      setError(ru.stageShift.datesUnchanged)
      return
    }
    if (!payload.comment) {
      setError(ru.stageShift.commentRequired)
      return
    }
    setError(null)
    await onConfirm(payload)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal wide stage-shift-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.stageShift.title(stage.name)}</h2>
        <p className="muted">{ru.stageShift.subtitle}</p>
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
          <label>
            {ru.stageShift.comment}
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value)
                if (error) setError(null)
              }}
              placeholder={ru.stageShift.commentPlaceholder}
              rows={3}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions stage-date-change-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
              {ru.stageShift.cancel}
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? ru.stageShift.submitting : ru.stageShift.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
