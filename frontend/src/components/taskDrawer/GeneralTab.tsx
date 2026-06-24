import { ru } from '../../locale/ru'
import { TaskFieldCombobox } from '../TaskFieldCombobox'
import { isoDateInputValue } from '../../utils/taskFieldSuggestions'
import { useTaskDrawerContext } from './TaskDrawerContext'

export function TaskDrawerGeneralTab() {
  const ctx = useTaskDrawerContext()
  return (
          <section>
            <label>
              {ru.drawer.taskDescription}
              <input
                key={`name-${ctx.effective.name}`}
                defaultValue={ctx.effective.name}
                onBlur={(e) => {
                  const value = e.target.value.trim()
                  if (value && value !== ctx.task.name) ctx.patch('name', value)
                }}
              />
            </label>
            <label>
              Приоритет
              <input
                type="number"
                key={`pri-${ctx.effective.priority}`}
                defaultValue={ctx.effective.priority ?? ''}
                onBlur={(e) => ctx.patch('priority', e.target.value ? Number(e.target.value) : null)}
              />
            </label>
            <TaskFieldCombobox
              listId={`ctx.task-${ctx.task.id}-subproduct`}
              label={ru.drawer.showcase}
              value={ctx.effective.subproduct ?? ''}
              suggestions={ctx.generalFieldSuggestions.subproduct}
              onCommit={(value) => ctx.patch('subproduct', value)}
            />
            <TaskFieldCombobox
              listId={`ctx.task-${ctx.task.id}-data-source`}
              label="Источник"
              value={ctx.effective.component_name ?? ctx.effective.data_source ?? ''}
              suggestions={ctx.generalFieldSuggestions.data_source}
              readOnly={Boolean(ctx.task.component_id)}
              onCommit={(value) => {
                if (!ctx.task.component_id) ctx.patch('data_source', value)
              }}
            />
            {!ctx.task.component_id && (
              <section className="shared-source-panel">
                <p className="muted shared-source-panel-hint">{ru.components.promoteHint}</p>
                {ctx.matchingComponent && (
                  <p className="muted">
                    {ru.components.matchBySource(ctx.matchingComponent.data_source)}
                  </p>
                )}
                <div className="shared-source-panel-actions">
                  <button
                    type="button"
                    className="btn-small"
                    disabled={ctx.promoteToComponent.isPending || !ctx.dataSourceValue}
                    title={!ctx.dataSourceValue ? ru.components.dataSourceRequired : undefined}
                    onClick={() => ctx.promoteToComponent.mutate(ctx.dataSourceValue || undefined)}
                  >
                    {ctx.promoteToComponent.isPending
                      ? ru.components.promoting
                      : ru.components.promoteToShared}
                  </button>
                  {ctx.matchingComponent && (
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      disabled={ctx.linkComponent.isPending}
                      onClick={() => ctx.linkComponent.mutate(ctx.matchingComponent!.id)}
                    >
                      {ctx.linkComponent.isPending
                        ? ru.components.linking
                        : ru.components.linkToShared}
                    </button>
                  )}
                </div>
                {ctx.linkableComponents.length > 0 && (
                  <div className="shared-source-link-row">
                    <label>
                      {ru.components.linkSelectLabel}
                      <select
                        value={ctx.linkComponentId}
                        onChange={(e) =>
                          ctx.setLinkComponentId(e.target.value ? Number(e.target.value) : '')
                        }
                      >
                        <option value="">—</option>
                        {ctx.linkableComponents.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.data_source} ({ru.components.usageCount(c.usage_count)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      disabled={ctx.linkComponent.isPending || !ctx.linkComponentId}
                      onClick={() => {
                        if (ctx.linkComponentId) ctx.linkComponent.mutate(ctx.linkComponentId)
                      }}
                    >
                      {ctx.linkComponent.isPending ? ru.components.linking : ru.components.link}
                    </button>
                  </div>
                )}
              </section>
            )}
            <TaskFieldCombobox
              listId={`ctx.task-${ctx.task.id}-forms`}
              label="Формы"
              value={ctx.effective.forms ?? ''}
              suggestions={ctx.generalFieldSuggestions.forms}
              onCommit={(value) => ctx.patch('forms', value)}
            />
            <TaskFieldCombobox
              listId={`ctx.task-${ctx.task.id}-customer`}
              label="Заказчик"
              value={ctx.effective.customer ?? ''}
              suggestions={ctx.generalFieldSuggestions.customer}
              onCommit={(value) => ctx.patch('customer', value)}
            />
            <TaskFieldCombobox
              listId={`ctx.task-${ctx.task.id}-platform`}
              label="Площадка"
              value={ctx.effective.platform ?? ''}
              suggestions={ctx.generalFieldSuggestions.platform}
              onCommit={(value) => ctx.patch('platform', value)}
            />
            <TaskFieldCombobox
              listId={`ctx.task-${ctx.task.id}-area`}
              label="Область"
              value={ctx.effective.area ?? ''}
              suggestions={ctx.generalFieldSuggestions.area}
              onCommit={(value) => ctx.patch('area', value)}
            />
            <label>
              Желаемый срок
              <input
                type="date"
                key={`dq-${ctx.effective.desired_quarter}`}
                defaultValue={isoDateInputValue(ctx.effective.desired_quarter)}
                onChange={(e) => ctx.patch('desired_quarter', e.target.value || null)}
              />
            </label>
            {ctx.renderTabComment('general')}
          </section>
  )
}
