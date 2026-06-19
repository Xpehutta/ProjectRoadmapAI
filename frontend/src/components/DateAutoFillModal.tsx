import { useState } from 'react'
import { ru } from '../locale/ru'

interface Props {
  message: string
  suggestedDate: string
  dateLabel?: string
  onConfirm: (date: string) => void
  onCancel: () => void
}

export function DateAutoFillModal({
  message,
  suggestedDate,
  dateLabel,
  onConfirm,
  onCancel,
}: Props) {
  const [manual, setManual] = useState(false)
  const [manualDate, setManualDate] = useState(suggestedDate)
  const [error, setError] = useState<string | null>(null)

  const applyManual = () => {
    if (!manualDate) {
      setError(ru.dateAutoFill.invalidDate)
      return
    }
    onConfirm(manualDate)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal date-autofill-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.dateAutoFill.title}</h2>
        <p>{message}</p>
        <p className="date-autofill-suggested muted">
          {ru.dateAutoFill.suggestedDate}: <strong>{suggestedDate}</strong>
        </p>

        {manual && (
          <label>
            {dateLabel ?? ru.dateAutoFill.dateLabel}
            <input
              type="date"
              value={manualDate}
              onChange={(e) => {
                setManualDate(e.target.value)
                if (error) setError(null)
              }}
              autoFocus
            />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions date-autofill-actions">
          {!manual ? (
            <>
              <button type="button" onClick={() => onConfirm(suggestedDate)}>
                {ru.dateAutoFill.fill}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setManual(true)
                  setManualDate(suggestedDate)
                }}
              >
                {ru.dateAutoFill.fillManually}
              </button>
              <button type="button" className="btn-secondary" onClick={onCancel}>
                {ru.dateAutoFill.cancel}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={applyManual}>
                {ru.dateAutoFill.apply}
              </button>
              <button type="button" className="btn-secondary" onClick={onCancel}>
                {ru.dateAutoFill.cancel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
