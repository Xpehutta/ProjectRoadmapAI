import { ru } from '../locale/ru'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  kind?: 'task' | 'milestone'
}

export function ShiftCommentCollapsible({ label, value, onChange, kind = 'task' }: Props) {
  const hasComment = value.trim().length > 0
  const summary = hasComment
    ? ru.shift.commentOn(label)
    : kind === 'milestone'
      ? ru.shift.addCommentMilestone(label)
      : ru.shift.addCommentTask(label)

  return (
    <details className="shift-comment" open={hasComment}>
      <summary>{summary}</summary>
      <textarea
        className="shift-comment-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ru.shift.whyRescheduled}
        rows={2}
        onClick={(e) => e.stopPropagation()}
      />
    </details>
  )
}
