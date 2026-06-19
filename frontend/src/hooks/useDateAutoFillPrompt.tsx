import { useCallback, useRef, useState } from 'react'
import { DateAutoFillModal } from '../components/DateAutoFillModal'

interface PromptState {
  message: string
  suggestedDate: string
  dateLabel?: string
}

export function useDateAutoFillPrompt() {
  const resolveRef = useRef<((date: string | null) => void) | null>(null)
  const [prompt, setPrompt] = useState<PromptState | null>(null)

  const requestDate = useCallback(
    (message: string, suggestedDate: string, dateLabel?: string): Promise<string | null> =>
      new Promise((resolve) => {
        resolveRef.current = resolve
        setPrompt({ message, suggestedDate, dateLabel })
      }),
    []
  )

  const finish = useCallback((date: string | null) => {
    resolveRef.current?.(date)
    resolveRef.current = null
    setPrompt(null)
  }, [])

  const dateAutoFillModal = prompt ? (
    <DateAutoFillModal
      message={prompt.message}
      suggestedDate={prompt.suggestedDate}
      dateLabel={prompt.dateLabel}
      onConfirm={(date) => finish(date)}
      onCancel={() => finish(null)}
    />
  ) : null

  return { requestDate, dateAutoFillModal }
}
