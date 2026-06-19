import type { SubStage } from '../types'
import { ru } from '../locale/ru'
import { collectInternalStageLinks } from '../utils/stageInternalDeps'

interface Props {
  stages: SubStage[]
  onRemove: (predStageId: number, succStageId: number) => void | Promise<void>
  busy?: boolean
  saveError?: string | null
}

export function StageInternalDependenciesEditor({ stages, onRemove, busy, saveError }: Props) {
  const links = collectInternalStageLinks(stages)

  if (stages.length < 2) return null

  return (
    <div className="stage-internal-deps-editor">
      <div className="stage-internal-deps-header">
        <h4>{ru.drawer.stageInternalDependencies}</h4>
        <p className="muted">{ru.drawer.stageInternalDependenciesHint}</p>
      </div>

      {links.length === 0 && (
        <p className="muted stage-internal-deps-empty">{ru.drawer.stageInternalDependenciesEmpty}</p>
      )}

      {links.length > 0 && (
        <ul className="stage-internal-deps-list">
          {links.map((link) => (
            <li key={link.key} className="stage-internal-dep-item">
              <span>
                {ru.drawer.stageInternalDependencyLabel(
                  link.predNumber,
                  link.predName,
                  link.succNumber,
                  link.succName
                )}
              </span>
              <button
                type="button"
                className="link-btn"
                disabled={busy}
                onClick={() => void onRemove(link.predStageId, link.succStageId)}
              >
                {ru.drawer.stageInternalDependencyRemove}
              </button>
            </li>
          ))}
        </ul>
      )}

      {saveError && <p className="form-error stage-internal-dep-error">{saveError}</p>}
    </div>
  )
}
