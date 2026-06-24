import { ru } from '../../locale/ru'
import { useTaskDrawerContext } from './TaskDrawerContext'

export function TaskDrawerContractorTab() {
  const ctx = useTaskDrawerContext()
  return (
          <section>
            <h3>{ru.drawer.contractorInfo}</h3>
            <label>
              Подрядчик
              <input
                key={`con-${ctx.effective.contractor}`}
                defaultValue={ctx.effective.contractor ?? ''}
                onBlur={(e) => ctx.patch('contractor', e.target.value || null)}
              />
            </label>
            <label>
              {ru.drawer.plannedCost}
              <input
                key={`pc-${ctx.effective.planned_cost}`}
                defaultValue={ctx.effective.planned_cost ?? ''}
                onBlur={(e) => ctx.patch('planned_cost', e.target.value || null)}
              />
            </label>
            <label>
              {ru.drawer.actualCost}
              <input
                key={`ac-${ctx.effective.actual_cost}`}
                defaultValue={ctx.effective.actual_cost ?? ''}
                onBlur={(e) => ctx.patch('actual_cost', e.target.value || null)}
              />
            </label>
            {ctx.renderTabComment('contractor')}
          </section>
  )
}
