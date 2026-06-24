import { ru } from '../../locale/ru'
import { PlannedEffortCalculator } from '../PlannedEffortCalculator'
import {
  EFFORT_K_AN_KEY,
  EFFORT_K_DEV_KEY,
  EFFORT_K_DM_KEY,
  EFFORT_K_MA_KEY,
} from '../../utils/effortCalculator'
import { SHOWCASE_DEVELOPMENT_KEY } from '../../utils/drawerTabFields'
import { useTaskDrawerContext } from './TaskDrawerContext'

export function TaskDrawerEffortTab() {
  const ctx = useTaskDrawerContext()
  return (
          <section>
            <label>
              {ru.drawer.attributeCount}
              <input
                key={`attr-${ctx.effective.attribute_count}`}
                defaultValue={ctx.effective.attribute_count ?? ''}
                onBlur={(e) => ctx.patch('attribute_count', e.target.value || null)}
              />
            </label>
            <label className="toggle inline-toggle drawer-checkbox-field">
              <input
                type="checkbox"
                checked={ctx.showcaseDevRequired}
                onChange={(e) => {
                  const checked = e.target.checked
                  ctx.setShowcaseDevRequired(checked)
                  ctx.patchCustomField(SHOWCASE_DEVELOPMENT_KEY, checked ? 'true' : 'false')
                }}
              />
              {ru.drawer.showcaseDevelopmentRequired}
            </label>
            <PlannedEffortCalculator
              key={`effort-calc-${ctx.task.id}-${ctx.effortKAn}-${ctx.effortKDev}-${ctx.effortKMa}-${ctx.effortKDm}-${ctx.showcaseDevRequired}-${ctx.effective.attribute_count}`}
              attributeCount={ctx.effective.attribute_count}
              plannedEffort={ctx.effective.planned_effort}
              showcaseDevelopmentRequired={ctx.showcaseDevRequired}
              kAn={ctx.effortKAn}
              kDev={ctx.effortKDev}
              kMa={ctx.effortKMa}
              kDm={ctx.effortKDm}
              onKAnBlur={(value) => ctx.patchCustomField(EFFORT_K_AN_KEY, value)}
              onKDevBlur={(value) => ctx.patchCustomField(EFFORT_K_DEV_KEY, value)}
              onKMaBlur={(value) => ctx.patchCustomField(EFFORT_K_MA_KEY, value)}
              onKDmBlur={(value) => ctx.patchCustomField(EFFORT_K_DM_KEY, value)}
              onApply={(effort) => {
                ctx.patch('planned_effort', effort)
                ctx.setPlannedEffortInputKey((n) => n + 1)
              }}
            />
            <label>
              {ru.drawer.plannedEffort}
              <input
                key={`pe-${ctx.effective.planned_effort}-${ctx.plannedEffortInputKey}`}
                defaultValue={ctx.effective.planned_effort ?? ''}
                onBlur={(e) => ctx.patch('planned_effort', e.target.value || null)}
              />
            </label>
            <label>
              {ru.drawer.actualEffort}
              <input
                key={`ae-${ctx.effective.actual_effort}`}
                defaultValue={ctx.effective.actual_effort ?? ''}
                onBlur={(e) => ctx.patch('actual_effort', e.target.value || null)}
              />
            </label>
            {ctx.renderTabComment('effort')}
          </section>
  )
}
