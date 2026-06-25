import { ru } from '../locale/ru'

interface Props {
  projectName: string
  taskCount: number
  deleting?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteProjectModal({
  projectName,
  taskCount,
  deleting,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="modal-overlay" onClick={deleting ? undefined : onCancel}>
      <div className="modal delete-project-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.startPage.delete.title(projectName)}</h2>
        <p>{ru.startPage.delete.message}</p>
        {taskCount > 0 && (
          <p className="muted">{ru.startPage.delete.tasksWarning(taskCount)}</p>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" disabled={deleting} onClick={onCancel}>
            {ru.startPage.delete.cancel}
          </button>
          <button type="button" className="btn-danger" disabled={deleting} onClick={onConfirm}>
            {deleting ? ru.startPage.delete.deleting : ru.startPage.delete.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
