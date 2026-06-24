import { ru, formatLocaleDateTime, HISTORY_FILTER_OPTIONS } from '../../locale/ru'
import { formatScore, MOSCOW_OPTIONS, prioritizationScore } from '../../utils/scoring'
import type { Moscow } from '../../types'
import { DateShiftIndicator } from '../DateShiftIndicator'
import { PendingShiftComment } from '../PendingShiftComment'
import { taskNeedsDependencyStartFill } from '../../utils/taskDependencyDates'
import { useTaskDrawerContext } from './TaskDrawerContext'

export function TaskDrawerOtherTab() {
  const ctx = useTaskDrawerContext()
  return (
          <>
            <section>
              <h3>
                {ru.drawer.planning}
                <span className="score-badge has-score">
                  {formatScore(prioritizationScore(ctx.effective, ctx.prioritizationMethod), ctx.prioritizationMethod)}
                </span>
              </h3>
              <label>
                {ru.backlog.release}
                <select
                  key={`rel-${ctx.effective.release_id}`}
                  defaultValue={ctx.effective.release_id ?? ''}
                  onChange={(e) => ctx.patch('release_id', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{ru.releases.unassigned}</option>
                  {(ctx.project.releases ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {ru.backlog.goal}
                <select
                  key={`goal-${ctx.effective.goal_id}`}
                  defaultValue={ctx.effective.goal_id ?? ''}
                  onChange={(e) => ctx.patch('goal_id', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{ru.goals.none}</option>
                  {(ctx.project.goals ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                MoSCoW
                <select
                  key={`moscow-${ctx.effective.moscow}`}
                  defaultValue={ctx.effective.moscow ?? ''}
                  onChange={(e) => ctx.patch('moscow', (e.target.value || null) as Moscow | null)}
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
                    key={`reach-${ctx.effective.rice_reach}`}
                    defaultValue={ctx.effective.rice_reach ?? ''}
                    onBlur={(e) => ctx.patch('rice_reach', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  RICE {ru.backlog.impact}
                  <input
                    type="number"
                    key={`impact-${ctx.effective.rice_impact}`}
                    defaultValue={ctx.effective.rice_impact ?? ''}
                    onBlur={(e) => ctx.patch('rice_impact', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  RICE {ru.backlog.confidence}
                  <input
                    type="number"
                    key={`conf-${ctx.effective.rice_confidence}`}
                    defaultValue={ctx.effective.rice_confidence ?? ''}
                    onBlur={(e) => ctx.patch('rice_confidence', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  RICE {ru.backlog.effort}
                  <input
                    type="number"
                    key={`eff-${ctx.effective.rice_effort}`}
                    defaultValue={ctx.effective.rice_effort ?? ''}
                    onBlur={(e) => ctx.patch('rice_effort', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  {ru.backlog.value}
                  <input
                    type="number"
                    key={`val-${ctx.effective.value_score}`}
                    defaultValue={ctx.effective.value_score ?? ''}
                    onBlur={(e) => ctx.patch('value_score', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  {ru.backlog.effort}
                  <input
                    type="number"
                    key={`ves-${ctx.effective.effort_score}`}
                    defaultValue={ctx.effective.effort_score ?? ''}
                    onBlur={(e) => ctx.patch('effort_score', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
              </div>
            </section>

            <section>
              <h3>{ru.drawer.factDates}</h3>
              <label>
                Начало (факт)
                <input
                  type="date"
                  key={`start-${ctx.effective.start_date}`}
                  defaultValue={ctx.effective.start_date ?? ''}
                  onBlur={async (e) => {
                    let start = e.target.value || null
                    if (!start && !ctx.effective.start_date) {
                      const fill = taskNeedsDependencyStartFill(
                        ctx.project,
                        ctx.task,
                        ctx.effectiveTasksById,
                        ctx.dependencyDrafts,
                        ctx.effective.start_date,
                        ctx.dependencyDraftsAuthoritative
                      )
                      if (fill) {
                        start = await ctx.requestDate(
                          ru.drawer.autoFillFromTaskDependencyPrompt(fill.label, fill.date),
                          fill.date,
                          ru.drawer.stageStartDate
                        )
                      }
                    }
                    ctx.stageTaskChange(ctx.task, {
                      start_date: start,
                      end_date: ctx.effective.end_date,
                    })
                  }}
                />
                {(() => {
                  const hint = taskNeedsDependencyStartFill(
                    ctx.project,
                    ctx.task,
                    ctx.effectiveTasksById,
                    ctx.dependencyDrafts,
                    ctx.effective.start_date,
                    ctx.dependencyDraftsAuthoritative
                  )
                  return hint ? (
                    <span className="dependency-start-hint muted">
                      {ru.drawer.dependencyStartHint(hint.label, hint.date)}
                    </span>
                  ) : null
                })()}
              </label>
              <label>
                Окончание (факт)
                <input
                  type="date"
                  key={`end-${ctx.effective.end_date}`}
                  defaultValue={ctx.effective.end_date ?? ''}
                  onBlur={(e) =>
                    ctx.stageTaskChange(ctx.task, {
                      start_date: ctx.effective.start_date,
                      end_date: e.target.value || null,
                    })
                  }
                />
              </label>
              {ctx.dateShifts.length > 0 && (
                <div className="drawer-date-shift">
                  <DateShiftIndicator
                    shifts={ctx.dateShifts}
                    entityKey={`ctx.task-${ctx.task.id}`}
                    entityLabel={ctx.task.name}
                  />
                </div>
              )}
              <PendingShiftComment taskId={ctx.task.id} taskName={ctx.task.name} />
            </section>

            <section>
              <label>
                Риски
                <textarea
                  key={`risks-${ctx.effective.risks}`}
                  defaultValue={ctx.effective.risks ?? ''}
                  rows={2}
                  onBlur={(e) => ctx.patch('risks', e.target.value || null)}
                />
              </label>
            </section>

            <section>
              <h3>{ru.drawer.comments}</h3>
              <div className="ctx.comment-list">
                {ctx.comments.map((c) => (
                  <div key={c.id} className="ctx.comment">
                    <div className="ctx.comment-meta">
                      <strong>{c.user_name}</strong> · {formatLocaleDateTime(c.created_at)}
                    </div>
                    <p>{c.body}</p>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (ctx.comment.trim()) ctx.addComment.mutate(ctx.comment.trim())
                }}
              >
                <textarea
                  value={ctx.comment}
                  onChange={(e) => ctx.setComment(e.target.value)}
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
                    className={ctx.historyFilter === f.id ? 'active' : ''}
                    onClick={() => ctx.setHistoryFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="ctx.history-list">
                {ctx.history.map((h) => (
                  <div key={h.id} className="ctx.history-item">
                    <div className="ctx.history-meta">
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
                {!ctx.history.length && <p className="muted">{ru.drawer.noHistory}</p>}
              </div>
            </section>

            <section>{ctx.renderTabComment('other')}</section>

            <section className="ctx.task-drawer-danger">
              <button
                type="button"
                className="btn-danger btn-danger-block"
                disabled={ctx.deleteTask.isPending}
                onClick={ctx.handleDeleteTask}
              >
                {ctx.deleteTask.isPending ? ru.drawer.deletingTask : ru.drawer.deleteTask}
              </button>
            </section>
          </>
  )
}
