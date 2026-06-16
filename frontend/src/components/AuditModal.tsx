import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { AUDIT_FILTER_OPTIONS, formatLocaleDateTime, ru } from '../locale/ru'
import { useUIStore } from '../stores/uiStore'
import type { AuditEventType } from '../types'

interface Props {
  projectId: number
}

export function AuditModal({ projectId }: Props) {
  const setShowAuditModal = useUIStore((s) => s.setShowAuditModal)
  const [filter, setFilter] = useState<AuditEventType | 'all'>('all')

  const { data: events = [] } = useQuery({
    queryKey: ['audit', projectId, filter],
    queryFn: () => api.getProjectAudit(projectId, filter === 'all' ? undefined : filter),
  })

  return (
    <div className="modal-overlay" onClick={() => setShowAuditModal(false)}>
      <div className="modal wide tall" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.audit.title}</h2>
        <div className="filter-chips">
          {AUDIT_FILTER_OPTIONS.map((f) => (
            <button
              key={f.id}
              className={filter === f.id ? 'active' : ''}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="audit-list">
          {events.map((e) => (
            <div key={e.id} className="history-item">
              <div className="history-meta">
                <span className="badge">{ru.audit.eventType[e.event_type]}</span>
                {ru.audit.task} #{e.task_id} · <strong>{e.user_name}</strong> ·{' '}
                {formatLocaleDateTime(e.created_at)}
              </div>
              {e.field && (
                <p>
                  <code>{e.field}</code>: {e.old_value ?? '—'} → {e.new_value ?? '—'}
                </p>
              )}
            </div>
          ))}
          {!events.length && <p className="muted">{ru.audit.empty}</p>}
        </div>
        <button onClick={() => setShowAuditModal(false)}>{ru.audit.close}</button>
      </div>
    </div>
  )
}
