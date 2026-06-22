import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useUIStore } from '../stores/uiStore'
import { ru } from '../locale/ru'
import type { ProjectDetail } from '../types'

interface Props {
  project: ProjectDetail
  onClose: () => void
}

export function ComponentManager({ project, onClose }: Props) {
  const qc = useQueryClient()
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const [dataSource, setDataSource] = useState('')
  const [error, setError] = useState<string | null>(null)

  const components = [...(project.components ?? [])].sort((a, b) =>
    a.data_source.localeCompare(b.data_source, 'ru')
  )

  const invalidate = () => qc.invalidateQueries({ queryKey: ['project', project.id] })

  const create = useMutation({
    mutationFn: (name: string) =>
      api.createComponent(project.id, { name, data_source: name }),
    onSuccess: () => {
      setDataSource('')
      setError(null)
      invalidate()
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    const name = dataSource.trim()
    if (!name) return
    create.mutate(name)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide tall" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.components.title}</h2>
        <p className="muted">{ru.components.subtitle}</p>

        <form className="component-create-form" onSubmit={handleCreate}>
          <input
            value={dataSource}
            onChange={(e) => {
              setDataSource(e.target.value)
              if (error) setError(null)
            }}
            placeholder={ru.components.createPlaceholder}
          />
          <button type="submit" disabled={create.isPending || !dataSource.trim()}>
            {create.isPending ? ru.components.creating : ru.components.add}
          </button>
        </form>
        {error && <p className="form-error">{error}</p>}

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
