import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { ShiftCommentCollapsible } from './ShiftCommentCollapsible'
import { pluralUnsavedChanges, ru } from '../locale/ru'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useSavedDateShiftsStore } from '../stores/savedDateShiftsStore'
import { getTaskDateShiftFromPendingChange } from '../utils/dateShift'

interface Props {
  projectId: number
}

export function SaveChangesBar({ projectId }: Props) {
  const taskChanges = usePendingChangesStore((s) => s.taskChanges)
  const milestones = usePendingChangesStore((s) => s.milestones)
  const setTaskShiftComment = usePendingChangesStore((s) => s.setTaskShiftComment)
  const setMilestoneShiftComment = usePendingChangesStore((s) => s.setMilestoneShiftComment)
  const clearAll = usePendingChangesStore((s) => s.clearAll)
  const recordTaskFromPending = useSavedDateShiftsStore((s) => s.recordTaskFromPending)
  const recordMilestoneFromPending = useSavedDateShiftsStore((s) => s.recordMilestoneFromPending)
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const taskList = Object.values(taskChanges)
  const milestoneList = Object.values(milestones)
  const total = taskList.length + milestoneList.length

  const tasksWithDateShifts = useMemo(
    () => taskList.filter((t) => getTaskDateShiftFromPendingChange(t)),
    [taskList]
  )

  if (total === 0) return null

  const persist = async (recordShifts: boolean) => {
    setSaving(true)
    setError(null)
    try {
      for (const m of milestoneList) {
        await api.updateMilestone(projectId, m.milestoneId, { date: m.date })
      }
      for (const t of taskList) {
        const body: Record<string, unknown> = { version: t.version, ...t.patch }
        if (typeof t.patch.predecessor_refs === 'string') {
          body.predecessor_refs = String(t.patch.predecessor_refs)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        }
        await api.updateTask(t.taskId, body)
        if (recordShifts && getTaskDateShiftFromPendingChange(t) && t.shiftComment?.trim()) {
          await api.addComment(t.taskId, t.shiftComment.trim())
        }
      }
      if (recordShifts) {
        for (const t of taskList) recordTaskFromPending(t)
        for (const m of milestoneList) recordMilestoneFromPending(m)
      }
      clearAll()
      await qc.invalidateQueries({ queryKey: ['project', projectId] })
      await qc.invalidateQueries({ queryKey: ['comments'] })
      await qc.invalidateQueries({ queryKey: ['history'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : ru.saveBar.failed)
    } finally {
      setSaving(false)
    }
  }

  const save = () => persist(true)
  const saveWithoutShift = () => persist(false)

  const discard = () => {
    clearAll()
    setError(null)
  }

  const hasShiftComments = tasksWithDateShifts.length > 0 || milestoneList.length > 0

  return (
    <div className="save-changes-bar" role="status">
      <div className="save-changes-body">
        <div className="save-changes-message">
          <strong>{pluralUnsavedChanges(total)}</strong>
          <span className="save-changes-detail">
            {taskList.map((t) => t.taskName).join(', ')}
            {taskList.length > 0 && milestoneList.length > 0 ? '; ' : ''}
            {milestoneList.map((m) => m.name).join(', ')}
          </span>
          {error && <span className="save-changes-error">{error}</span>}
        </div>

        {hasShiftComments && (
          <div className="save-changes-shift-comments">
            {tasksWithDateShifts.map((t) => (
              <ShiftCommentCollapsible
                key={`task-${t.taskId}`}
                label={t.taskName}
                value={t.shiftComment ?? ''}
                onChange={(comment) => setTaskShiftComment(t.taskId, comment)}
                kind="task"
              />
            ))}
            {milestoneList.map((m) => (
              <ShiftCommentCollapsible
                key={`ms-${m.milestoneId}`}
                label={m.name}
                value={m.shiftComment ?? ''}
                onChange={(comment) => setMilestoneShiftComment(m.milestoneId, comment)}
                kind="milestone"
              />
            ))}
          </div>
        )}
      </div>

      <div className="save-changes-actions">
        <button type="button" className="btn-discard" onClick={discard} disabled={saving}>
          {ru.saveBar.discard}
        </button>
        <button type="button" className="btn-save-quiet" onClick={saveWithoutShift} disabled={saving}>
          {saving ? ru.saveBar.saving : ru.saveBar.saveWithoutShift}
        </button>
        <button type="button" className="btn-save" onClick={save} disabled={saving}>
          {saving ? ru.saveBar.saving : ru.saveBar.save}
        </button>
      </div>
    </div>
  )
}
