import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { ru } from '../locale/ru'
import type { ProjectDetail, Release, ReleaseStatus } from '../types'

interface Props {
  project: ProjectDetail
  onClose: () => void
}

const STATUS_OPTIONS = (Object.keys(ru.releases.status) as ReleaseStatus[]).map((id) => ({
  id,
  label: ru.releases.status[id],
}))

export function ReleaseManager({ project, onClose }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [color, setColor] = useState('#6366f1')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['project', project.id] })

  const create = useMutation({
    mutationFn: () =>
      api.createRelease(project.id, {
        name,
        target_date: targetDate || null,
        color,
        sort_order: project.releases.length,
      }),
    onSuccess: () => {
      setName('')
      setTargetDate('')
      invalidate()
    },
  })

  const update = async (release: Release, field: string, value: unknown) => {
    await api.updateRelease(project.id, release.id, { [field]: value })
    invalidate()
  }

  const remove = async (release: Release) => {
    if (!confirm(ru.releases.deleteConfirm(release.name))) return
    await api.deleteRelease(project.id, release.id)
    invalidate()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.releases.title}</h2>
        <p className="muted">{ru.releases.subtitle}</p>
        <ul className="category-list">
          {project.releases.map((release) => (
            <li key={release.id} className="release-list-item">
              <input
                type="color"
                defaultValue={release.color}
                onChange={(e) => update(release, 'color', e.target.value)}
              />
              <input
                defaultValue={release.name}
                onBlur={(e) => update(release, 'name', e.target.value)}
              />
              <input
                type="date"
                defaultValue={release.target_date ?? ''}
                onBlur={(e) => update(release, 'target_date', e.target.value || null)}
                title={ru.releases.targetDate}
              />
              <select
                defaultValue={release.status}
                onChange={(e) => update(release, 'status', e.target.value)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button className="btn-danger" onClick={() => remove(release)}>
                {ru.releases.delete}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="category-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) create.mutate()
          }}
        >
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ru.releases.newPlaceholder}
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            title={ru.releases.targetDate}
          />
          <button type="submit">{ru.releases.add}</button>
        </form>
        <button onClick={onClose}>{ru.releases.close}</button>
      </div>
    </div>
  )
}
