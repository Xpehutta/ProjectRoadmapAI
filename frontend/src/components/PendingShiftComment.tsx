import { ShiftCommentCollapsible } from './ShiftCommentCollapsible'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { getTaskDateShiftFromPendingChange } from '../utils/dateShift'

interface Props {
  taskId: number
  taskName: string
}

export function PendingShiftComment({ taskId, taskName }: Props) {
  const change = usePendingChangesStore((s) => s.taskChanges[taskId])
  const setTaskShiftComment = usePendingChangesStore((s) => s.setTaskShiftComment)

  if (!change || !getTaskDateShiftFromPendingChange(change)) return null

  return (
    <div className="pending-shift-comment">
      <ShiftCommentCollapsible
        label={taskName}
        value={change.shiftComment ?? ''}
        onChange={(comment) => setTaskShiftComment(taskId, comment)}
        kind="task"
      />
    </div>
  )
}
