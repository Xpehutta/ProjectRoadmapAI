import { DeleteStageModal } from './DeleteStageModal'
import { StageCompleteModal } from './StageCompleteModal'
import { StageShiftModal } from './StageShiftModal'
import type { ProjectDetail, Task } from '../types'
import { ru } from '../locale/ru'
import { TaskDrawerContractorTab } from './taskDrawer/ContractorTab'
import { TaskDrawerEffortTab } from './taskDrawer/EffortTab'
import { TaskDrawerGeneralTab } from './taskDrawer/GeneralTab'
import { TaskDrawerOtherTab } from './taskDrawer/OtherTab'
import { TaskDrawerStagesTab } from './taskDrawer/StagesTab'
import { TaskDrawerProvider, useTaskDrawerContext } from './taskDrawer/TaskDrawerContext'
import { DRAWER_TABS } from './taskDrawer/types'

interface Props {
  project: ProjectDetail
  task: Task
}

function TaskDrawerShell() {
  const ctx = useTaskDrawerContext()
  const {
    task,
    effective,
    hasPending,
    otherUsages,
    setSelectedTaskId,
    unlink,
    activeTab,
    setActiveTab,
    completingStage,
    setCompletingStage,
    handleStageCompleteConfirm,
    completingStageSubmitting,
    shiftingStage,
    cancelStageShift,
    handleStageShiftConfirm,
    shiftingStageSubmitting,
    dateAutoFillModal,
    stageToDelete,
    setStageToDelete,
    handleDeleteStageConfirm,
    deletingStage,
  } = ctx

  return (
    <>
      <aside className="task-drawer">
        <header>
          <h2>
            {effective.name}
            {hasPending && <span className="pending-badge drawer-title-badge">{ru.drawer.unsaved}</span>}
          </h2>
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
            <p className="muted">{ru.components.bannerHint(task.component_usage_count)}</p>
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

        <nav className="task-drawer-tabs" aria-label="Разделы задачи">
          {DRAWER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {ru.drawer.tabs[tab.labelKey]}
            </button>
          ))}
        </nav>

        <div className="task-drawer-tab-panel">
          {activeTab === 'general' && <TaskDrawerGeneralTab />}
          {activeTab === 'stages' && <TaskDrawerStagesTab />}
          {activeTab === 'contractor' && <TaskDrawerContractorTab />}
          {activeTab === 'effort' && <TaskDrawerEffortTab />}
          {activeTab === 'other' && <TaskDrawerOtherTab />}
        </div>
      </aside>

      {completingStage && (
        <StageCompleteModal
          stage={completingStage}
          onCancel={() => setCompletingStage(null)}
          onConfirm={handleStageCompleteConfirm}
          submitting={completingStageSubmitting}
        />
      )}
      {shiftingStage && (
        <StageShiftModal
          stage={shiftingStage.stage}
          initial={shiftingStage.initial}
          mode={shiftingStage.mode}
          onCancel={cancelStageShift}
          onConfirm={handleStageShiftConfirm}
          submitting={shiftingStageSubmitting}
        />
      )}
      {dateAutoFillModal}
      {stageToDelete && (
        <DeleteStageModal
          stageName={stageToDelete.stage.name}
          isDone={stageToDelete.stage.is_done}
          warnings={stageToDelete.warnings}
          onCancel={() => setStageToDelete(null)}
          onConfirm={handleDeleteStageConfirm}
          deleting={deletingStage}
        />
      )}
    </>
  )
}

export function TaskDrawer({ project, task }: Props) {
  return (
    <TaskDrawerProvider project={project} task={task}>
      <TaskDrawerShell />
    </TaskDrawerProvider>
  )
}
