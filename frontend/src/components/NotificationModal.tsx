import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, getNotificationEmail, setNotificationEmail } from '../api/client'
import { ru } from '../locale/ru'
import { useUIStore } from '../stores/uiStore'

interface Props {
  projectId: number
}

export function NotificationModal({ projectId }: Props) {
  const setShowNotificationModal = useUIStore((s) => s.setShowNotificationModal)
  const [email, setEmail] = useState(() => getNotificationEmail())
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  const trimmed = email.trim().toLowerCase()

  const { data: status, isLoading } = useQuery({
    queryKey: ['notification-status', projectId, trimmed],
    queryFn: () => api.getNotificationStatus(projectId, trimmed),
    enabled: trimmed.includes('@'),
  })

  useEffect(() => {
    if (trimmed.includes('@')) setNotificationEmail(trimmed)
  }, [trimmed])

  const subscribe = useMutation({
    mutationFn: () => api.subscribeNotifications(projectId, trimmed),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['notification-status', projectId] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : ru.notifications.error),
  })

  const unsubscribe = useMutation({
    mutationFn: () => api.unsubscribeNotifications(projectId, trimmed),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['notification-status', projectId] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : ru.notifications.error),
  })

  const subscribed = status?.subscribed ?? false
  const serverConfigured = status?.notifications_configured ?? false

  return (
    <div className="modal-overlay" onClick={() => setShowNotificationModal(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.notifications.title}</h2>
        <p className="muted">{ru.notifications.description}</p>

        {!serverConfigured && (
          <div className="project-chat-notice">{ru.notifications.notConfigured}</div>
        )}

        <label className="field-label">
          {ru.notifications.emailLabel}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={ru.notifications.emailPlaceholder}
            autoComplete="email"
          />
        </label>

        {isLoading && trimmed.includes('@') && <p className="muted">{ru.notifications.checking}</p>}
        {!isLoading && trimmed.includes('@') && (
          <p className="muted">
            {subscribed ? ru.notifications.subscribed : ru.notifications.notSubscribed}
          </p>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          {subscribed ? (
            <button
              type="button"
              className="danger"
              disabled={!trimmed.includes('@') || unsubscribe.isPending}
              onClick={() => unsubscribe.mutate()}
            >
              {unsubscribe.isPending ? ru.notifications.unsubscribing : ru.notifications.unsubscribe}
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              disabled={!trimmed.includes('@') || subscribe.isPending || !serverConfigured}
              onClick={() => subscribe.mutate()}
            >
              {subscribe.isPending ? ru.notifications.subscribing : ru.notifications.subscribe}
            </button>
          )}
          <button type="button" onClick={() => setShowNotificationModal(false)}>
            {ru.notifications.close}
          </button>
        </div>
      </div>
    </div>
  )
}
