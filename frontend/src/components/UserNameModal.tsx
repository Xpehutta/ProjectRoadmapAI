import { useState } from 'react'
import { setUserName } from '../api/client'
import { ru } from '../locale/ru'
import { useUIStore } from '../stores/uiStore'

export function UserNameModal() {
  const userName = useUIStore((s) => s.userName)
  const setStoreName = useUIStore((s) => s.setUserName)
  const [name, setName] = useState(userName)
  const [open, setOpen] = useState(!userName)

  if (!open) return null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setUserName(name.trim())
    setStoreName(name.trim())
    setOpen(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{ru.welcome.title}</h2>
        <p>{ru.welcome.subtitle}</p>
        <form onSubmit={submit}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ru.welcome.namePlaceholder}
          />
          <button type="submit">{ru.welcome.continue}</button>
        </form>
      </div>
    </div>
  )
}
