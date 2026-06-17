import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { DateShiftIndicator } from './DateShiftIndicator'
import { PendingShiftComment } from './PendingShiftComment'
import { useTaskDateShifts } from '../hooks/useTaskDateShift'
import { useEffectiveTask } from '../hooks/useEffectiveTasks'
import { useDeleteTask } from '../hooks/useProject'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useUIStore } from '../stores/uiStore'
import type { AuditEventType, Moscow, ProjectDetail, StageTemplate, Task } from '../types'
import {
  CUSTOM_STAGE_VALUE,
  existingStageNameSet,
  groupStageTemplates,
  stageNameTaken,
} from '../utils/stageTemplates'
import { formatLocaleDateTime, HISTORY_FILTER_OPTIONS, ru } from '../locale/ru'
import { formatScore, MOSCOW_OPTIONS, prioritizationScore } from '../utils/scoring'
import { refreshProjectAfterSubStageChange } from '../utils/subStageRefresh'

interface Props {
  project: ProjectDetail
  task: Task
}

export function TaskDrawer({ project, task }: Props) {
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const prioritizationMethod = useUIStore((s) => s.prioritizationMethod)
  const stageTaskChange = usePendingChangesStore((s) => s.stageTaskChange)
  const pending = usePendingChangesStore((s) => s.taskChanges[task.id])
  const qc = useQueryClient()
  const [historyFilter, setHistoryFilter] = useState<AuditEventType | 'all'>('all')
  const [comment, setComment] = useState('')
  const [newStageName, setNewStageName] = useState('')
  const [newStageDueDate, setNewStageDueDate] = useState('')
  const [newStageIndicative, setNewStageIndicative] = useState(false)
  const [addingStage, setAddingStage] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [saveTemplateForReuse, setSaveTemplateForReuse] = useState(false)

  const { data: stageLibrary } = useQuery({
    queryKey: ['stage-templates', project.id],
    queryFn: () => api.getStageTemplates(project.id),
  })

  const existingStageNames = useMemo(
    () => existingStageNameSet(task.sub_stages.map((s) => s.name)),
    [task.sub_stages]
  )

  const renderTemplateOptions = (templates: StageTemplate[] | undefined, sectionLabel: string) => {
    if (!templates?.length) return null
    const grouped = groupStageTemplates(templates)
    return (
      <optgroup label={sectionLabel}>
        {Array.from(grouped.entries()).flatMap(([group, items]) =>
          items.map((item) => {
            const taken = stageNameTaken(existingStageNames, item.full_label)
            return (
              <option key={`${sectionLabel}-${item.full_label}`} value={item.full_label} disabled={taken}>
                {group !== '—' ? `${group} → ${item.name}` : item.full_label}
                {taken ? ` (${ru.drawer.templateAlreadyOnTask})` : ''}
              </option>
            )
          })
        )}
      </optgroup>
    )
  }

  const effective = useEffectiveTask(project.tasks, task.id)
  const hasPending = Boolean(pending)
  const dateShifts = useTaskDateShifts(task)
  const linkedComponent = task.component_id
    ? project.components?.find((c) => c.id === task.component_id)
    : undefined
  const otherUsages =
    linkedComponent?.usages.filter((u) => u.id !== task.id) ?? []

  const unlink = useMutation({
    mutationFn: () => api.unlinkTaskComponent(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', project.id] })
    },
  })

  const deleteTask = useDeleteTask(project.id)

  const handleDeleteTask = () => {
    if (!confirm(ru.drawer.deleteTaskConfirm(task.name))) return
    deleteTask.mutate(task.id)
  }

  const stage = (field: string, value: unknown) => {
    stageTaskChange(task, { [field]: value })
  }

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: () => api.getComments(task.id),
  })

  const { data: history = [] } = useQuery({
    queryKey: ['history', task.id, historyFilter],
    queryFn: () =>
      api.getHistory(task.id, historyFilter === 'all' ? undefined : historyFilter),
  })

  const addComment = useMutation({
    mutationFn: (body: string) => api.addComment(task.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', task.id] })
      qc.invalidateQueries({ queryKey: ['history', task.id] })
      setComment('')
    },
  })

  const toggleStage = async (stageId: number, isDone: boolean) => {
    await api.updateSubStage(task.id, stageId, { is_done: !isDone })
    await refreshProjectAfterSubStageChange(qc, project.id)
  }

  const completeAll = async () => {
    await api.completeAllSubStages(task.id)
    await refreshProjectAfterSubStageChange(qc, project.id)
  }

  const addStage = async (e: FormEvent) => {
    e.preventDefault()
    const name = newStageName.trim()
    if (!name) return
    setAddingStage(true)
    try {
      await api.createSubStage(task.id, {
        name,
        sort_order: task.sub_stages.length,
        due_date: newStageDueDate || null,
        is_indicative: newStageIndicative,
      })
      if (saveTemplateForReuse && selectedTemplate === CUSTOM_STAGE_VALUE) {
        await api.addStageTemplate(project.id, { name, full_label: name })
        await qc.invalidateQueries({ queryKey: ['stage-templates', project.id] })
      }
      setNewStageName('')
      setNewStageDueDate('')
      setNewStageIndicative(false)
      setSelectedTemplate('')
      setSaveTemplateForReuse(false)
      await refreshProjectAfterSubStageChange(qc, project.id)
    } finally {
      setAddingStage(false)
    }
  }

  const handleTemplateSelect = (value: string) => {
    setSelectedTemplate(value)
    if (value === CUSTOM_STAGE_VALUE) {
      setNewStageName('')
      return
    }
    if (value) {
      setNewStageName(value)
      setSaveTemplateForReuse(false)
    }
  }

  const patch = async (field: string, value: unknown) => {
    stage(field, value)
  }

  return (
    <aside className="task-drawer">
      <header>
        <h2>{task.name}</h2>
        <button className="close-btn" onClick={() => setSelectedTaskId(null)}>
          ×
        </button>
      </header>

      {task.component_id && task.component_name && (
        <section className="shared-component-banner">
          <div className="shared-component-banner-title">
            <span className="badge shared-badge">{ru.components.sharedBadge}</span>
            {ru.components.bannerTitle}: <strong>{task.component_name}</strong>
          </div>
          <p className="muted">
            {ru.components.bannerHint(task.component_usage_count)}
          </p>
          {otherUsages.length > 0 && (
            <div className="shared-component-usages">
              <span className="muted">{ru.components.otherUsages}:</span>
              <ul>
                {otherUsages.map((usage) => (
                  <li key={usage.id}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setSelectedTaskId(usage.id)}
                    >
                      {usage.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate()}
          >
            {unlink.isPending ? ru.components.unlinking : ru.components.unlink}
          </button>
        </section>
      )}

      <section>
        <h3>
          Планирование {hasPending && <span className="pending-badge">{ru.drawer.unsaved}</span>}
          <span className="score-badge has-score">
            {formatScore(prioritizationScore(effective, prioritizationMethod), prioritizationMethod)}
          </span>
        </h3>
        <label>
          Приоритет
          <input
            type="number"
            key={`pri-${effective.priority}`}
            defaultValue={effective.priority ?? ''}
            onBlur={(e) => patch('priority', e.target.value ? Number(e.target.value) : null)}
          />
        </label>
        <label>
          {ru.backlog.release}
          <select
            key={`rel-${effective.release_id}`}
            defaultValue={effective.release_id ?? ''}
            onChange={(e) => patch('release_id', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{ru.releases.unassigned}</option>
            {(project.releases ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {ru.backlog.goal}
          <select
            key={`goal-${effective.goal_id}`}
            defaultValue={effective.goal_id ?? ''}
            onChange={(e) => patch('goal_id', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{ru.goals.none}</option>
            {(project.goals ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          MoSCoW
          <select
            key={`moscow-${effective.moscow}`}
            defaultValue={effective.moscow ?? ''}
            onChange={(e) => patch('moscow', (e.target.value || null) as Moscow | null)}
          >
            <option value="">—</option>
            {MOSCOW_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {ru.backlog.moscowLabels[m]}
              </option>
            ))}
          </select>
        </label>
        <div className="drawer-scoring-grid">
          <label>
            RICE {ru.backlog.reach}
            <input
              type="number"
              key={`reach-${effective.rice_reach}`}
              defaultValue={effective.rice_reach ?? ''}
              onBlur={(e) => patch('rice_reach', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label>
            RICE {ru.backlog.impact}
            <input
              type="number"
              key={`impact-${effective.rice_impact}`}
              defaultValue={effective.rice_impact ?? ''}
              onBlur={(e) => patch('rice_impact', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label>
            RICE {ru.backlog.confidence}
            <input
              type="number"
              key={`conf-${effective.rice_confidence}`}
              defaultValue={effective.rice_confidence ?? ''}
              onBlur={(e) => patch('rice_confidence', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label>
            RICE {ru.backlog.effort}
            <input
              type="number"
              key={`eff-${effective.rice_effort}`}
              defaultValue={effective.rice_effort ?? ''}
              onBlur={(e) => patch('rice_effort', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label>
            {ru.backlog.value}
            <input
              type="number"
              key={`val-${effective.value_score}`}
              defaultValue={effective.value_score ?? ''}
              onBlur={(e) => patch('value_score', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label>
            {ru.backlog.effort}
            <input
              type="number"
              key={`ves-${effective.effort_score}`}
              defaultValue={effective.effort_score ?? ''}
              onBlur={(e) => patch('effort_score', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
        </div>
      </section>

      <section>
        <h3>Витрина</h3>
        <label>
          Субпродукт
          <input
            key={`sub-${effective.subproduct}`}
            defaultValue={effective.subproduct ?? ''}
            onBlur={(e) => patch('subproduct', e.target.value || null)}
          />
        </label>
        <label>
          Источник
          <input
            key={`src-${effective.data_source}-${effective.component_name}`}
            defaultValue={effective.component_name ?? effective.data_source ?? ''}
            readOnly={Boolean(task.component_id)}
            className={task.component_id ? 'readonly-field' : undefined}
            onBlur={(e) => {
              if (!task.component_id) patch('data_source', e.target.value || null)
            }}
          />
        </label>
        <label>
          Формы
          <input
            key={`forms-${effective.forms}`}
            defaultValue={effective.forms ?? ''}
            onBlur={(e) => patch('forms', e.target.value || null)}
          />
        </label>
        <label>
          Заказчик
          <input
            key={`cust-${effective.customer}`}
            defaultValue={effective.customer ?? ''}
            onBlur={(e) => patch('customer', e.target.value || null)}
          />
        </label>
        <label>
          Площадка
          <input
            key={`plat-${effective.platform}`}
            defaultValue={effective.platform ?? ''}
            onBlur={(e) => patch('platform', e.target.value || null)}
          />
        </label>
        <label>
          Область
          <input
            key={`area-${effective.area}`}
            defaultValue={effective.area ?? ''}
            onBlur={(e) => patch('area', e.target.value || null)}
          />
        </label>
        <label>
          Подрядчик
          <input
            key={`con-${effective.contractor}`}
            defaultValue={effective.contractor ?? ''}
            onBlur={(e) => patch('contractor', e.target.value || null)}
          />
        </label>
        <label>
          Желаемый срок
          <input
            key={`dq-${effective.desired_quarter}`}
            defaultValue={effective.desired_quarter ?? ''}
            onBlur={(e) => patch('desired_quarter', e.target.value || null)}
          />
        </label>
        <label>
          Количество атрибутов
          <input
            key={`attr-${effective.attribute_count}`}
            defaultValue={effective.attribute_count ?? ''}
            onBlur={(e) => patch('attribute_count', e.target.value || null)}
          />
        </label>
        <label>
          Начало (факт)
          <input
            type="date"
            key={`start-${effective.start_date}`}
            defaultValue={effective.start_date ?? ''}
            onBlur={(e) =>
              stageTaskChange(task, {
                start_date: e.target.value || null,
                end_date: effective.end_date,
              })
            }
          />
        </label>
        <label>
          Окончание (факт)
          <input
            type="date"
            key={`end-${effective.end_date}`}
            defaultValue={effective.end_date ?? ''}
            onBlur={(e) =>
              stageTaskChange(task, {
                start_date: effective.start_date,
                end_date: e.target.value || null,
              })
            }
          />
        </label>
        {dateShifts.length > 0 && (
          <div className="drawer-date-shift">
            <DateShiftIndicator
              shifts={dateShifts}
              entityKey={`task-${task.id}`}
              entityLabel={task.name}
            />
          </div>
        )}
        <PendingShiftComment taskId={task.id} taskName={task.name} />
        <label>
          Индикативное начало
          <input
            type="date"
            key={`is-${effective.indicative_start}`}
            defaultValue={effective.indicative_start ?? ''}
            onBlur={(e) => patch('indicative_start', e.target.value || null)}
          />
        </label>
        <label>
          Индикативное окончание
          <input
            type="date"
            key={`ie-${effective.indicative_end}`}
            defaultValue={effective.indicative_end ?? ''}
            onBlur={(e) => patch('indicative_end', e.target.value || null)}
          />
        </label>
        <label>
          {ru.drawer.plannedCost}
          <input
            key={`pc-${effective.planned_cost}`}
            defaultValue={effective.planned_cost ?? ''}
            onBlur={(e) => patch('planned_cost', e.target.value || null)}
          />
        </label>
        <label>
          {ru.drawer.actualCost}
          <input
            key={`ac-${effective.actual_cost}`}
            defaultValue={effective.actual_cost ?? ''}
            onBlur={(e) => patch('actual_cost', e.target.value || null)}
          />
        </label>
        <label>
          {ru.drawer.plannedEffort}
          <input
            key={`pe-${effective.planned_effort}`}
            defaultValue={effective.planned_effort ?? ''}
            onBlur={(e) => patch('planned_effort', e.target.value || null)}
          />
        </label>
        <label>
          {ru.drawer.actualEffort}
          <input
            key={`ae-${effective.actual_effort}`}
            defaultValue={effective.actual_effort ?? ''}
            onBlur={(e) => patch('actual_effort', e.target.value || null)}
          />
        </label>
        <label>
          Риски
          <textarea
            key={`risks-${effective.risks}`}
            defaultValue={effective.risks ?? ''}
            rows={2}
            onBlur={(e) => patch('risks', e.target.value || null)}
          />
        </label>
        <label>
          Комментарий
          <textarea
            key={`notes-${effective.notes}`}
            defaultValue={effective.notes ?? ''}
            rows={2}
            onBlur={(e) => patch('notes', e.target.value || null)}
          />
        </label>
        <div className="completion-display">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${task.completion_pct}%` }}
            />
          </div>
          <span>{ru.drawer.complete(task.completion_pct)}</span>
        </div>
      </section>

      <section>
        <h3>
          Этапы
          {task.sub_stages.length > 0 && (
            <button className="btn-small" onClick={completeAll}>
              {ru.drawer.markAllDone}
            </button>
          )}
        </h3>
        <ul className="checklist phase-checklist">
          {task.sub_stages.map((s) => (
            <li key={s.id} className={s.is_indicative ? 'indicative-phase' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={s.is_done}
                  onChange={() => toggleStage(s.id, s.is_done)}
                />
                <span className={s.is_done ? 'done' : ''}>{s.name}</span>
              </label>
              <div className="phase-meta">
                {s.due_date && <span className="phase-date">{s.due_date}</span>}
                {s.note && s.note !== s.due_date && <span className="phase-note">{s.note}</span>}
              </div>
            </li>
          ))}
          {!task.sub_stages.length && <li className="muted">{ru.drawer.noStages}</li>}
        </ul>
        <form className="add-stage-form" onSubmit={addStage}>
          <label>
            {ru.drawer.pickFromTemplate}
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
            >
              <option value="">—</option>
              {renderTemplateOptions(stageLibrary?.predefined, ru.drawer.templatePredefined)}
              {renderTemplateOptions(stageLibrary?.custom, ru.drawer.templateCustom)}
              {renderTemplateOptions(stageLibrary?.used, ru.drawer.templateUsed)}
              <option value={CUSTOM_STAGE_VALUE}>{ru.drawer.customStageOption}</option>
            </select>
          </label>
          {(selectedTemplate === CUSTOM_STAGE_VALUE || !selectedTemplate) && (
            <label>
              {ru.drawer.stageName}
              <input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder={ru.drawer.stageNamePlaceholder}
              />
            </label>
          )}
          {selectedTemplate === CUSTOM_STAGE_VALUE && (
            <label className="toggle inline-toggle">
              <input
                type="checkbox"
                checked={saveTemplateForReuse}
                onChange={(e) => setSaveTemplateForReuse(e.target.checked)}
              />
              {ru.drawer.saveForReuse}
            </label>
          )}
          <label>
            {ru.drawer.stageDueDate}
            <input
              type="date"
              value={newStageDueDate}
              onChange={(e) => setNewStageDueDate(e.target.value)}
            />
          </label>
          <label className="toggle inline-toggle">
            <input
              type="checkbox"
              checked={newStageIndicative}
              onChange={(e) => setNewStageIndicative(e.target.checked)}
            />
            {ru.drawer.stageIndicative}
          </label>
          <button type="submit" className="btn-small" disabled={addingStage || !newStageName.trim()}>
            {addingStage ? ru.drawer.addingStage : ru.drawer.addStage}
          </button>
        </form>
      </section>

      <section>
        <h3>{ru.drawer.comments}</h3>
        <div className="comment-list">
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <div className="comment-meta">
                <strong>{c.user_name}</strong> · {formatLocaleDateTime(c.created_at)}
              </div>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (comment.trim()) addComment.mutate(comment.trim())
          }}
        >
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={ru.drawer.commentPlaceholder}
            rows={3}
          />
          <button type="submit">{ru.drawer.post}</button>
        </form>
      </section>

      <section>
        <h3>{ru.drawer.history}</h3>
        <div className="filter-chips">
          {HISTORY_FILTER_OPTIONS.map((f) => (
            <button
              key={f.id}
              className={historyFilter === f.id ? 'active' : ''}
              onClick={() => setHistoryFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="history-list">
          {history.map((h) => (
            <div key={h.id} className="history-item">
              <div className="history-meta">
                <span className="badge">{ru.audit.eventType[h.event_type]}</span>
                <strong>{h.user_name}</strong> · {formatLocaleDateTime(h.created_at)}
              </div>
              {h.field && (
                <p>
                  <code>{h.field}</code>: {h.old_value ?? '—'} → {h.new_value ?? '—'}
                </p>
              )}
            </div>
          ))}
          {!history.length && <p className="muted">{ru.drawer.noHistory}</p>}
        </div>
      </section>

      <section className="task-drawer-danger">
        <button
          type="button"
          className="btn-danger btn-danger-block"
          disabled={deleteTask.isPending}
          onClick={handleDeleteTask}
        >
          {deleteTask.isPending ? ru.drawer.deletingTask : ru.drawer.deleteTask}
        </button>
      </section>
    </aside>
  )
}
