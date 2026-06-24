import { ru } from '../../locale/ru'
import { isStagePlanned } from '../../utils/stageComplete'
import { stageDisplayNumber } from '../../utils/subStageDeps'
import { stageEffectiveEndDate } from '../../utils/subStageDates'
import { stageNeedsDependencyStartFill, suggestedStartFromDependencyDraft } from '../../utils/taskDependencyDates'
import { suggestedStartFromInternalStagePredIds } from '../../utils/stageInternalDeps'
import { PREDEFINED_STAGE_BUNDLES, bundleStagesToAdd } from '../../utils/stageBundles'
import { CUSTOM_STAGE_VALUE } from '../../utils/stageTemplates'
import { NewStageDependencyFields } from '../NewStageDependencyFields'
import { StageEndDateInput } from '../StageEndDateInput'
import { StageFocusDependenciesEditor } from '../StageFocusDependenciesEditor'
import { TaskDependenciesEditor } from '../TaskDependenciesEditor'
import { useTaskDrawerContext } from './TaskDrawerContext'

export function TaskDrawerStagesTab() {
  const ctx = useTaskDrawerContext()
  return (
          <section>
            <div className="completion-display drawer-tab-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${ctx.effective.completion_pct}%` }} />
              </div>
              <span>{ru.drawer.complete(ctx.effective.completion_pct)}</span>
            </div>
            <label>
              Индикативное начало
              <input
                type="date"
                key={`is-${ctx.effective.indicative_start}`}
                defaultValue={ctx.effective.indicative_start ?? ''}
                readOnly={ctx.indicativeFromStages}
                className={ctx.indicativeFromStages ? 'readonly-field' : undefined}
                onBlur={(e) => {
                  if (!ctx.indicativeFromStages) ctx.patch('indicative_start', e.target.value || null)
                }}
              />
            </label>
            <label>
              Индикативное окончание
              <input
                type="date"
                key={`ie-${ctx.effective.indicative_end}`}
                defaultValue={ctx.effective.indicative_end ?? ''}
                readOnly={ctx.indicativeFromStages}
                className={ctx.indicativeFromStages ? 'readonly-field' : undefined}
                onBlur={(e) => {
                  if (!ctx.indicativeFromStages) ctx.patch('indicative_end', e.target.value || null)
                }}
              />
            </label>
            {ctx.indicativeFromStages && (
              <p className="muted ctx.stage-indicative-hint">{ru.drawer.indicativeFromStages}</p>
            )}
            <h3>
              Этапы
              {ctx.hasPlannedStages && (
                <button className="btn-small" onClick={ctx.completeAll}>
                  {ru.drawer.markAllDone}
                </button>
              )}
            </h3>
            <ul className="checklist phase-checklist">
              {ctx.orderedStages.map((s, stageIndex) => (
                <li key={s.id} className={isStagePlanned(s) ? 'indicative-phase' : 'unplanned-phase'}>
                  <div className="phase-row-header">
                    <span className={`phase-title ${s.is_done ? 'done' : ''}`}>
                      <span className="phase-number">{stageDisplayNumber(stageIndex)}.</span>
                      {s.is_done ? '✓ ' : ''}
                      {s.name}
                    </span>
                    <div className="phase-actions">
                      {s.is_done ? (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => void ctx.toggleStage(s)}
                        >
                          {ru.drawer.unmarkStage}
                        </button>
                      ) : !isStagePlanned(s) ? (
                        <>
                          <button
                            type="button"
                            className="btn-small"
                            onClick={() => void ctx.openStagePlanWithAutoFill(s, stageIndex)}
                          >
                            {ru.drawer.stagePlan}
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-save-quiet"
                            onClick={() => void ctx.openStageCorrectWithAutoFill(s, stageIndex)}
                          >
                            {ru.drawer.stageCorrect}
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-danger"
                            onClick={() => ctx.openDeleteStage(s, stageIndex)}
                          >
                            {ru.deleteStage.deleteStage}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-small"
                            onClick={() => ctx.setCompletingStage(s)}
                          >
                            {ru.drawer.stageDone}
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-save-quiet"
                            onClick={() => void ctx.openStageShiftWithAutoFill(s, stageIndex)}
                          >
                            {ru.drawer.stageShift}
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-danger"
                            onClick={() => ctx.openDeleteStage(s, stageIndex)}
                          >
                            {ru.deleteStage.deleteStage}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {!s.is_done && (
                  <div className="phase-meta">
                    <label className="phase-date-field">
                      <span>{ru.drawer.stageStartDate}</span>
                      <input
                        key={`${s.id}-start-${s.start_date}-${ctx.stageDateInputReset}`}
                        type="date"
                        defaultValue={s.start_date ?? ''}
                        onBlur={(e) => ctx.handleStageDateBlur(s, 'start_date', e.target.value, stageIndex)}
                      />
                      {(() => {
                        const hint = stageNeedsDependencyStartFill(
                          ctx.project,
                          ctx.task,
                          s,
                          ctx.effectiveTasksById,
                          ctx.dependencyDrafts,
                          s.start_date,
                          ctx.dependencyDraftsAuthoritative
                        )
                        return hint ? (
                          <span className="dependency-start-hint muted">
                            {ru.drawer.dependencyStartHint(hint.label, hint.date)}
                          </span>
                        ) : null
                      })()}
                    </label>
                    <label className="phase-date-field">
                      <span>{ru.drawer.stageEndDate}</span>
                      <StageEndDateInput
                        startDate={s.start_date}
                        inputKey={`${s.id}-end-${s.end_date ?? s.due_date}-${ctx.stageDateInputReset}`}
                        defaultValue={s.end_date ?? s.due_date ?? ''}
                        onBlur={(value) => void ctx.handleStageDateBlur(s, 'end_date', value, stageIndex)}
                      />
                    </label>
                    {s.note && s.note !== stageEffectiveEndDate(s) && (
                      <span className="phase-note">{s.note}</span>
                    )}
                    <StageFocusDependenciesEditor
                      focusStageId={s.id}
                      stages={ctx.orderedStages}
                      links={ctx.effectiveInternalLinks}
                      busy={ctx.internalLinksBusy === s.id}
                      saveError={
                        ctx.internalLinksError?.stageId === s.id
                          ? ctx.internalLinksError.message
                          : null
                      }
                      onSave={(deps) => ctx.saveFocusStageDeps(s, deps)}
                    />
                  </div>
                  )}
                </li>
              ))}
              {!ctx.task.sub_stages.length && <li className="muted">{ru.drawer.noStages}</li>}
            </ul>
            <form className="add-ctx.stage-form" onSubmit={ctx.addStage}>
              <label>
                {ru.drawer.pickFromTemplate}
                <select
                  value={ctx.selectedTemplate}
                  onChange={(e) => ctx.handleTemplateSelect(e.target.value)}
                >
                  <option value="">—</option>
                  <optgroup label={ru.drawer.templateBundles}>
                    {PREDEFINED_STAGE_BUNDLES.map((bundle) => {
                      const count = ctx.stageLibrary?.predefined
                        ? bundleStagesToAdd(bundle, ctx.stageLibrary.predefined, ctx.existingStageNames).length
                        : 0
                      return (
                        <option key={bundle.id} value={bundle.id} disabled={count === 0}>
                          {bundle.label}
                          {count === 0
                            ? ` (${ru.drawer.templateAlreadyOnTask})`
                            : ` (${count})`}
                        </option>
                      )
                    })}
                  </optgroup>
                  {ctx.renderTemplateOptions(ctx.stageLibrary?.predefined, ru.drawer.templatePredefined)}
                  {ctx.renderTemplateOptions(ctx.stageLibrary?.custom, ru.drawer.templateCustom)}
                  {ctx.renderTemplateOptions(ctx.stageLibrary?.used, ru.drawer.templateUsed)}
                  <option value={CUSTOM_STAGE_VALUE}>{ru.drawer.customStageOption}</option>
                </select>
              </label>
              {ctx.selectedBundle && (
                <p className="muted ctx.stage-bundle-hint">
                  {ctx.bundleStageNamesToAdd.length > 0
                    ? ru.drawer.bundleStagesHint(ctx.bundleStageNamesToAdd.length)
                    : ru.drawer.bundleAllOnTask}
                </p>
              )}
              {(ctx.selectedTemplate === CUSTOM_STAGE_VALUE || !ctx.selectedTemplate) && (
                <label>
                  {ru.drawer.stageName}
                  <input
                    value={ctx.newStageName}
                    onChange={(e) => ctx.setNewStageName(e.target.value)}
                    placeholder={ru.drawer.stageNamePlaceholder}
                  />
                </label>
              )}
              {ctx.selectedTemplate === CUSTOM_STAGE_VALUE && (
                <label className="toggle inline-toggle">
                  <input
                    type="checkbox"
                    checked={ctx.saveTemplateForReuse}
                    onChange={(e) => ctx.setSaveTemplateForReuse(e.target.checked)}
                  />
                  <span className="toggle-label-text">{ru.drawer.saveForReuse}</span>
                </label>
              )}
              {!ctx.selectedBundle && (
                <NewStageDependencyFields
                  stageName={ctx.newStageName}
                  stageNumber={stageDisplayNumber(ctx.task.sub_stages.length)}
                  existingStages={ctx.orderedStages}
                  tasks={ctx.project.tasks}
                  currentTaskId={ctx.task.id}
                  crossTaskValue={ctx.newStageDependency}
                  onCrossTaskChange={ctx.setNewStageDependency}
                  internalDeps={ctx.newStageInternalDeps}
                  onInternalDepsChange={ctx.setNewStageInternalDeps}
                />
              )}
              {!ctx.selectedBundle && (
              <>
              <label>
                {ru.drawer.stageStartDate}
                <input
                  type="date"
                  value={ctx.newStageStartDate}
                  onChange={(e) => ctx.handleNewStageStartChange(e.target.value)}
                  onBlur={() => void ctx.handleNewStageStartBlur()}
                />
                {(() => {
                  if (ctx.newStageStartDate) return null
                  if (ctx.newStageDependency?.predecessorId) {
                    const hint = suggestedStartFromDependencyDraft(
                      ctx.newStageDependency,
                      ctx.effectiveTasksById
                    )
                    return hint ? (
                      <span className="dependency-start-hint muted">
                        {ru.drawer.dependencyStartHint(hint.label, hint.date)}
                      </span>
                    ) : null
                  }
                  if (ctx.newStageInternalDeps.some((d) => d.relation === 'after')) {
                    const hint = suggestedStartFromInternalStagePredIds(
                      ctx.orderedStages,
                      ctx.newStageInternalDeps
                        .filter((d) => d.relation === 'after')
                        .map((d) => d.refStageId)
                    )
                    return hint ? (
                      <span className="dependency-start-hint muted">
                        {ru.drawer.dependencyStartHint(hint.label, hint.date)}
                      </span>
                    ) : null
                  }
                  return null
                })()}
              </label>
              <label>
                {ru.drawer.stageEndDate}
                <StageEndDateInput
                  key={`new-ctx.stage-end-${ctx.newStageStartDate}`}
                  startDate={ctx.newStageStartDate}
                  value={ctx.newStageEndDate}
                  onChange={ctx.setNewStageEndDate}
                />
              </label>
              </>
              )}
              <button
                type="submit"
                className="btn-small"
                disabled={
                  ctx.addingStage ||
                  (ctx.selectedBundle
                    ? ctx.bundleStageNamesToAdd.length === 0
                    : !ctx.newStageName.trim())
                }
              >
                {ctx.addingStage
                  ? ctx.selectedBundle
                    ? ru.drawer.addingStages
                    : ru.drawer.addingStage
                  : ctx.selectedBundle && ctx.bundleStageNamesToAdd.length > 0
                    ? ru.drawer.addBundleStages(ctx.bundleStageNamesToAdd.length)
                    : ru.drawer.addStage}
              </button>
            </form>
            <TaskDependenciesEditor
              task={ctx.effective}
              tasks={ctx.project.tasks}
              drafts={ctx.dependencyDrafts}
              onChange={ctx.handleDependencyDraftsChange}
              onDraftConfigured={(draft) => void ctx.offerAutofillForDependencyDraft(draft)}
            />
            {ctx.renderTabComment('stages')}
          </section>
  )
}
