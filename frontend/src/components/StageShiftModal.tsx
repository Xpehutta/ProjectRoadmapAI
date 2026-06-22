import { useState } from 'react'
import type { SubStage } from '../types'
import { ru } from '../locale/ru'
import { stageDatesChanged, stagePlannedDates, isStagePlanned } from '../utils/stageComplete'
import { StageEndDateInput } from './StageEndDateInput'

export type StageDateModalMode = 'shift' | 'plan' | 'correct'

interface Props {
  stage: SubStage
  initial?: { start_date: string | null; end_date: string | null }
  mode?: StageDateModalMode
  onCancel: () => void
  onConfirm: (data: {
    start_date: string | null
    end_date: string | null
    comment: string
  }) => void | Promise<void>
  submitting?: boolean
}

export function StageShiftModal({ stage, initial, mode = 'shift', onCancel, onConfirm, submitting }: Props) {
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
    const datesChanged = stageDatesChanged(stage, payload)
    if (!datesChanged && !(mode === 'plan' && !isStagePlanned(stage))) {
      setError(ru.stageShift.datesUnchanged)
      return
    }
    if (mode === 'shift' && !payload.comment) {
      setError(ru.stageShift.commentRequired)
      return
    }
    setError(null)
    await onConfirm(payload)
  }

  const title =
    mode === 'plan'
      ? ru.stageShift.planTitle(stage.name)
      : mode === 'correct'
        ? ru.stageShift.correctTitle(stage.name)
        : ru.stageShift.title(stage.name)

  const subtitle =
    mode === 'plan'
      ? ru.stageShift.planSubtitle
      : mode === 'correct'
        ? ru.stageShift.correctSubtitle
        : ru.stageShift.subtitle

  const confirmLabel =
    mode === 'plan'
      ? ru.stageShift.planConfirm
      : mode === 'correct'
        ? ru.stageShift.correctConfirm
        : ru.stageShift.confirm

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal wide stage-shift-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
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
            <StageEndDateInput
              startDate={startDate}
              value={endDate}
              onChange={setEndDate}
            />
          </label>
          {mode === 'shift' && (
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
          )}
          {mode === 'correct' && (
            <label>
              {ru.stageShift.correctComment}
              <textarea
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value)
                  if (error) setError(null)
                }}
                placeholder={ru.stageShift.correctCommentPlaceholder}
                rows={3}
              />
            </label>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions stage-date-change-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
              {ru.stageShift.cancel}
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? ru.stageShift.submitting : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
