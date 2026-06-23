import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { ru } from '../locale/ru'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  projectId: number
  projectName: string
}

export function ProjectChat({ projectId, projectName }: Props) {
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    void api
      .getChatStatus(projectId)
      .then((status) => {
        setConfigured(status.configured)
        setModel(status.model)
      })
      .catch(() => setConfigured(false))
  }, [open, projectId])

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [open, messages, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const response = await api.sendChatMessage(projectId, nextMessages)
      setMessages([...nextMessages, { role: 'assistant', content: response.reply }])
      if (response.model) setModel(response.model)
    } catch (err) {
      setError(err instanceof Error ? err.message : ru.chat.error)
      setMessages(messages)
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  return (
    <div className={`project-chat ${open ? 'open' : ''}`}>
      {open && (
        <div className="project-chat-panel" role="dialog" aria-label={ru.chat.title}>
          <header className="project-chat-header">
            <div>
              <h2>{ru.chat.title}</h2>
              <p className="project-chat-subtitle">
                {projectName}
                {model ? ` · ${model}` : ''}
              </p>
            </div>
            <div className="project-chat-header-actions">
              {messages.length > 0 && (
                <button type="button" className="link-btn" onClick={clearChat}>
                  {ru.chat.clear}
                </button>
              )}
              <button
                type="button"
                className="project-chat-close"
                onClick={() => setOpen(false)}
                aria-label={ru.chat.close}
              >
                ×
              </button>
            </div>
          </header>

          {configured === false && (
            <div className="project-chat-notice">{ru.chat.notConfigured}</div>
          )}

          <div className="project-chat-messages" ref={listRef}>
            {messages.length === 0 && !loading && (
              <div className="project-chat-empty">
                <p>{ru.chat.welcome}</p>
                <ul>
                  {ru.chat.suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        className="project-chat-suggestion"
                        onClick={() => setInput(s)}
                        disabled={configured === false}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`project-chat-bubble ${msg.role}`}>
                <span className="project-chat-role">
                  {msg.role === 'user' ? ru.chat.you : ru.chat.assistant}
                </span>
                <div className="project-chat-content">{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="project-chat-bubble assistant">
                <span className="project-chat-role">{ru.chat.assistant}</span>
                <div className="project-chat-content project-chat-typing">{ru.chat.thinking}</div>
              </div>
            )}
          </div>

          {error && <div className="project-chat-error">{error}</div>}

          <footer className="project-chat-footer">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ru.chat.placeholder}
              rows={2}
              disabled={loading || configured === false}
            />
            <button
              type="button"
              className="primary"
              onClick={() => void handleSend()}
              disabled={!input.trim() || loading || configured === false}
            >
              {loading ? ru.chat.sending : ru.chat.send}
            </button>
          </footer>
        </div>
      )}

      <button
        type="button"
        className="project-chat-fab"
        onClick={() => setOpen((v) => !v)}
        title={ru.chat.title}
        aria-expanded={open}
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  )
}
