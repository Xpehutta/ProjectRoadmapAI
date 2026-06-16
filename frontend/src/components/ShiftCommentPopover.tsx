import { ru } from '../locale/ru'

interface Props {
  label: string
  comment: string
  saved: boolean
  onChange?: (value: string) => void
  onClose: () => void
}

export function ShiftCommentPopover({ label, comment, saved, onChange, onClose }: Props) {
  const editable = !saved && Boolean(onChange)

  return (
    <div className="shift-comment-popover" onClick={(e) => e.stopPropagation()}>
      <div className="shift-comment-popover-header">
        <strong>{label}</strong>
        <button type="button" className="shift-comment-close" onClick={onClose} aria-label={ru.shift.close}>
          ×
        </button>
      </div>
      {editable ? (
        <textarea
          className="shift-comment-input"
          value={comment}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={ru.shift.whyRescheduled}
          rows={3}
          autoFocus
        />
      ) : comment.trim() ? (
        <p className="shift-comment-readonly">{comment}</p>
      ) : (
        <p className="shift-comment-empty">{ru.shift.noComment}</p>
      )}
      {saved && comment.trim() ? (
        <span className="shift-comment-saved-tag">{ru.shift.savedTag}</span>
      ) : null}
    </div>
  )
}
