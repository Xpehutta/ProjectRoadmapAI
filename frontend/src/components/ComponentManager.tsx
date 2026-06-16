import { useUIStore } from '../stores/uiStore'
import { ru } from '../locale/ru'
import type { ProjectDetail } from '../types'

interface Props {
  project: ProjectDetail
  onClose: () => void
}

export function ComponentManager({ project, onClose }: Props) {
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const components = [...(project.components ?? [])].sort((a, b) =>
    a.data_source.localeCompare(b.data_source, 'ru')
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide tall" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.components.title}</h2>
        <p className="muted">{ru.components.subtitle}</p>
        {components.length === 0 ? (
          <p className="muted">{ru.components.empty}</p>
        ) : (
          <ul className="component-list">
            {components.map((component) => (
              <li key={component.id} className="component-item">
                <div className="component-item-header">
                  <strong>{component.data_source}</strong>
                  {component.usage_count > 1 && (
                    <span className="badge shared-badge">{ru.components.sharedBadge}</span>
                  )}
                  <span className="muted">
                    {ru.components.usageCount(component.usage_count)}
                  </span>
                </div>
                {component.usages.length > 0 && (
                  <ul className="component-usages">
                    {component.usages.map((usage) => (
                      <li key={usage.id}>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => {
                            setSelectedTaskId(usage.id)
                            onClose()
                          }}
                        >
                          {usage.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        <button onClick={onClose}>{ru.components.close}</button>
      </div>
    </div>
  )
}
