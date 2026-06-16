import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { ru } from '../locale/ru'
import type { Goal, ProjectDetail } from '../types'

interface Props {
  project: ProjectDetail
  onClose: () => void
}

export function GoalManager({ project, onClose }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#059669')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['project', project.id] })

  const create = useMutation({
    mutationFn: () =>
      api.createGoal(project.id, {
        name,
        color,
        sort_order: project.goals.length,
      }),
    onSuccess: () => {
      setName('')
      invalidate()
    },
  })

  const update = async (goal: Goal, field: string, value: string) => {
    await api.updateGoal(project.id, goal.id, { [field]: value })
    invalidate()
  }

  const remove = async (goal: Goal) => {
    if (!confirm(ru.goals.deleteConfirm(goal.name))) return
    await api.deleteGoal(project.id, goal.id)
    invalidate()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.goals.title}</h2>
        <p className="muted">{ru.goals.subtitle}</p>
        <ul className="category-list">
          {project.goals.map((goal) => (
            <li key={goal.id}>
              <input
                type="color"
                defaultValue={goal.color}
                onChange={(e) => update(goal, 'color', e.target.value)}
              />
              <input
                defaultValue={goal.name}
                onBlur={(e) => update(goal, 'name', e.target.value)}
              />
              <button className="btn-danger" onClick={() => remove(goal)}>
                {ru.goals.delete}
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
            placeholder={ru.goals.newPlaceholder}
          />
          <button type="submit">{ru.goals.add}</button>
        </form>
        <button onClick={onClose}>{ru.goals.close}</button>
      </div>
    </div>
  )
}
