import { useMemo, useState } from 'react'
import type { StageInternalLink, SubStage } from '../types'
import { ru } from '../locale/ru'
import {
  dependenciesForFocusStage,
  stageOptionsForInternalDeps,
  type StageFocusDependency,
} from '../utils/stageInternalDeps'

interface Props {
  focusStageId: number
  stages: SubStage[]
  links: StageInternalLink[]
  onSave: (deps: StageFocusDependency[]) => Promise<void>
  busy?: boolean
  saveError?: string | null
}

export function StageFocusDependenciesEditor({
  focusStageId,
  stages,
  links,
  onSave,
  busy,
  saveError,
}: Props) {
  const [draft, setDraft] = useState<StageFocusDependency[] | null>(null)
  const [addRefId, setAddRefId] = useState<number | ''>('')
  const [addRelation, setAddRelation] = useState<StageFocusDependency['relation']>('after')

  const saved = useMemo(
    () => dependenciesForFocusStage(focusStageId, links),
    [focusStageId, links]
  )
  const deps = draft ?? saved

  const options = stageOptionsForInternalDeps(stages, focusStageId)
  const usedRefIds = new Set(deps.map((d) => d.refStageId))
  const availableToAdd = options.filter((opt) => !usedRefIds.has(opt.id))

  const persist = async (next: StageFocusDependency[]) => {
    setDraft(next)
    try {
      await onSave(next)
      setDraft(null)
    } catch {
      setDraft(next)
    }
  }

  const updateRelation = (refStageId: number, relation: StageFocusDependency['relation']) => {
    void persist(deps.map((d) => (d.refStageId === refStageId ? { ...d, relation } : d)))
  }

  const removeDep = (refStageId: number) => {
    void persist(deps.filter((d) => d.refStageId !== refStageId))
  }

  const addDep = () => {
    if (!addRefId || usedRefIds.has(addRefId)) return
    void persist([...deps, { refStageId: addRefId, relation: addRelation }])
    setAddRefId('')
    setAddRelation('after')
  }

  const labelForRef = (refStageId: number) =>
    options.find((o) => o.id === refStageId)?.label ?? String(refStageId)

  if (!options.length) return null

  return (
    <div className="stage-focus-deps">
      <span className="stage-focus-deps-label">{ru.drawer.stageInternalLinks}</span>
      {deps.length === 0 ? (
        <p className="muted stage-focus-deps-empty">{ru.drawer.stageInternalLinksEmpty}</p>
      ) : (
        <ul className="stage-focus-deps-list">
          {deps.map((dep) => (
            <li key={dep.refStageId} className="stage-focus-dep-item">
              <span className="stage-focus-dep-ref">{labelForRef(dep.refStageId)}</span>
              <label className="stage-focus-dep-type">
                <select
                  value={dep.relation}
                  disabled={busy}
                  onChange={(e) =>
                    updateRelation(dep.refStageId, e.target.value as StageFocusDependency['relation'])
                  }
                >
                  <option value="after">{ru.drawer.newStageInternalRelationAfter}</option>
                  <option value="before">{ru.drawer.newStageInternalRelationBefore}</option>
                </select>
              </label>
              <button
                type="button"
                className="btn-small btn-danger"
                disabled={busy}
                onClick={() => removeDep(dep.refStageId)}
              >
                {ru.drawer.stageInternalLinkRemove}
              </button>
            </li>
          ))}
        </ul>
      )}
      {availableToAdd.length > 0 && (
        <div className="stage-focus-deps-add">
          <select
            value={addRefId}
            disabled={busy}
            onChange={(e) => setAddRefId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">{ru.drawer.stageInternalLinkPickStage}</option>
            {availableToAdd.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={addRelation}
            disabled={busy}
            onChange={(e) => setAddRelation(e.target.value as StageFocusDependency['relation'])}
          >
            <option value="after">{ru.drawer.newStageInternalRelationAfter}</option>
            <option value="before">{ru.drawer.newStageInternalRelationBefore}</option>
          </select>
          <button
            type="button"
            className="btn-small"
            disabled={busy || !addRefId}
            onClick={addDep}
          >
            {ru.drawer.stageInternalLinkAdd}
          </button>
        </div>
      )}
      {saveError && <p className="stage-focus-dep-error">{saveError}</p>}
    </div>
  )
}
