import { ru } from '../locale/ru'

interface Props {
  projectName: string
  projectDescription: string
  jiraProjectKey: string
  creating?: boolean
  error?: string | null
  onConfirmWithEpic: () => void
  onConfirmWithoutEpic: () => void
  onCancel: () => void
}

export function JiraEpicOfferModal({
  projectName,
  projectDescription,
  jiraProjectKey,
  creating,
  error,
  onConfirmWithEpic,
  onConfirmWithoutEpic,
  onCancel,
}: Props) {
  return (
    <div className="modal-overlay" onClick={creating ? undefined : onCancel}>
      <div className="modal jira-epic-offer-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.jira.epicOffer.title}</h2>
        <p>{ru.jira.epicOffer.message(jiraProjectKey)}</p>
        <dl className="jira-epic-offer-summary">
          <div>
            <dt>{ru.startPage.projectName}</dt>
            <dd>{projectName}</dd>
          </div>
          {projectDescription && (
            <div>
              <dt>{ru.startPage.description}</dt>
              <dd>{projectDescription}</dd>
            </div>
          )}
        </dl>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onConfirmWithEpic} disabled={creating}>
            {creating ? ru.jira.epicOffer.creating : ru.jira.epicOffer.createWithEpic}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onConfirmWithoutEpic}
            disabled={creating}
          >
            {ru.jira.epicOffer.createWithoutEpic}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={creating}>
            {ru.startPage.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
