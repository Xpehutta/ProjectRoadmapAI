import { beforeEach, describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { usePendingChangesStore } from './pendingChangesStore'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    project_id: 1,
    name: 'Задача',
    status: 'todo',
    version: 1,
    sub_stages: [],
    predecessors: [],
    ...overrides,
  } as Task
}

describe('pendingChangesStore', () => {
  beforeEach(() => {
    usePendingChangesStore.getState().clearAll()
  })

  it('stages field changes without persisting until cleared', () => {
    const t = task({ name: 'Исходное имя' })
    usePendingChangesStore.getState().stageTaskChange(t, { name: 'Новое имя' })
    expect(usePendingChangesStore.getState().hasTaskPending(1)).toBe(true)
    expect(usePendingChangesStore.getState().getTaskPatch(1)).toEqual({ name: 'Новое имя' })
  })

  it('drops pending change when value reverts to original', () => {
    const t = task({ priority: 3 })
    const { stageTaskChange } = usePendingChangesStore.getState()
    stageTaskChange(t, { priority: 5 })
    stageTaskChange(t, { priority: 3 })
    expect(usePendingChangesStore.getState().hasTaskPending(1)).toBe(false)
  })

  it('counts pending task and milestone changes', () => {
    const t = task()
    usePendingChangesStore.getState().stageTaskChange(t, { name: 'X' })
    usePendingChangesStore.getState().stageMilestone({
      milestoneId: 9,
      name: 'M',
      date: '2024-06-01',
      original_date: '2024-05-01',
    })
    expect(usePendingChangesStore.getState().count()).toBe(2)
    expect(usePendingChangesStore.getState().hasPending()).toBe(true)
  })
})
