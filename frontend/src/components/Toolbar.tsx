import { useUIStore } from '../stores/uiStore'
import { useNow } from '../hooks/useNow'
import { formatLocaleDateTime, ru, VIEW_OPTIONS } from '../locale/ru'

interface Props {
  projectName: string
  onManageCategories: () => void
  onManageComponents: () => void
  onManageReleases: () => void
  onManageGoals: () => void
  onExitProject: () => void
}

export function Toolbar({
  projectName,
  onManageCategories,
  onManageComponents,
  onManageReleases,
  onManageGoals,
  onExitProject,
}: Props) {
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const groupingMode = useUIStore((s) => s.groupingMode)
  const setGroupingMode = useUIStore((s) => s.setGroupingMode)
  const showIndicative = useUIStore((s) => s.showIndicative)
  const setShowIndicative = useUIStore((s) => s.setShowIndicative)
  const showShiftComments = useUIStore((s) => s.showShiftComments)
  const setShowShiftComments = useUIStore((s) => s.setShowShiftComments)
  const setShowAuditModal = useUIStore((s) => s.setShowAuditModal)
  const setShowNotificationModal = useUIStore((s) => s.setShowNotificationModal)
  const userName = useUIStore((s) => s.userName)
  const now = useNow()

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <button
          type="button"
          className="toolbar-home"
          onClick={onExitProject}
          title={ru.toolbar.allProjects}
        >
          {ru.toolbar.projects}
        </button>
        <h1>{projectName}</h1>
        <button
          type="button"
          className={`toolbar-summary-report${viewMode === 'quarter_report' ? ' active' : ''}`}
          onClick={() => setViewMode('quarter_report')}
        >
          {ru.toolbar.summaryReport}
        </button>
        <time className="toolbar-datetime" dateTime={now.toISOString()}>
          {formatLocaleDateTime(now)}
        </time>
        <span className="user-badge">{userName}</span>
      </div>
      <div className="toolbar-center">
        {VIEW_OPTIONS.map((v) => (
          <button
            key={v.id}
            className={viewMode === v.id ? 'active' : ''}
            onClick={() => setViewMode(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="toolbar-right">
        <label className="toggle">
          <input
            type="checkbox"
            checked={showIndicative}
            onChange={(e) => setShowIndicative(e.target.checked)}
          />
          {ru.toolbar.indicative}
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showShiftComments}
            onChange={(e) => setShowShiftComments(e.target.checked)}
          />
          {ru.toolbar.shiftComments}
        </label>
        <select
          value={groupingMode}
          onChange={(e) => setGroupingMode(e.target.value as 'color' | 'swimlane')}
          title={ru.toolbar.groupingTitle}
        >
          <option value="color">{ru.toolbar.colorCoding}</option>
          <option value="swimlane">{ru.toolbar.categoryGroups}</option>
        </select>
        <button onClick={onManageCategories}>{ru.toolbar.categories}</button>
        <button onClick={onManageComponents}>{ru.components.toolbar}</button>
        <button onClick={onManageReleases}>{ru.releases.toolbar}</button>
        <button onClick={onManageGoals}>{ru.goals.toolbar}</button>
        <button onClick={() => setShowNotificationModal(true)}>{ru.toolbar.notifications}</button>
        <button onClick={() => setShowAuditModal(true)}>{ru.toolbar.audit}</button>
      </div>
    </header>
  )
}
