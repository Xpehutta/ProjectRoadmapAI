import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { ru } from '../locale/ru'
import type { Category, ProjectDetail } from '../types'

interface Props {
  project: ProjectDetail
  onClose: () => void
}

export function CategoryManager({ project, onClose }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['project', project.id] })

  const create = useMutation({
    mutationFn: () =>
      api.createCategory(project.id, {
        name,
        color,
        sort_order: project.categories.length,
      }),
    onSuccess: () => {
      setName('')
      invalidate()
    },
  })

  const update = async (cat: Category, field: string, value: string) => {
    await api.updateCategory(project.id, cat.id, { [field]: value })
    invalidate()
  }

  const remove = async (cat: Category) => {
    if (!confirm(ru.categories.deleteConfirm(cat.name))) return
    await api.deleteCategory(project.id, cat.id)
    invalidate()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.categories.title}</h2>
        <ul className="category-list">
          {project.categories.map((cat) => (
            <li key={cat.id}>
              <input
                type="color"
                defaultValue={cat.color}
                onChange={(e) => update(cat, 'color', e.target.value)}
              />
              <input
                defaultValue={cat.name}
                onBlur={(e) => update(cat, 'name', e.target.value)}
              />
              <button className="btn-danger" onClick={() => remove(cat)}>
                {ru.categories.delete}
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
            placeholder={ru.categories.newPlaceholder}
          />
          <button type="submit">{ru.categories.add}</button>
        </form>
        <button onClick={onClose}>{ru.categories.close}</button>
      </div>
    </div>
  )
}
