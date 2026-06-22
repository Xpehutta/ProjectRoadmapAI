import { useEffect, useState } from 'react'
import { AuditModal } from './components/AuditModal'
import { BacklogView } from './components/BacklogView'
import { CategoryManager } from './components/CategoryManager'
import { ComponentManager } from './components/ComponentManager'
import { GanttView } from './components/GanttView'
import { GoalManager } from './components/GoalManager'
import { KanbanView } from './components/KanbanView'
import { ReleaseBoardView } from './components/ReleaseBoardView'
import { ReleaseManager } from './components/ReleaseManager'
import { TableView } from './components/TableView'
import { TaskDrawer } from './components/TaskDrawer'
import { TimelineView } from './components/TimelineView'
import { Toolbar } from './components/Toolbar'
import { ProjectStartPage } from './components/ProjectStartPage'
import { SaveChangesBar } from './components/SaveChangesBar'
import { UserNameModal } from './components/UserNameModal'
import { useStageStatusPrompt } from './hooks/useStageStatusPrompt'
import { useCreateProject, useImportProject, useProject, useProjects } from './hooks/useProject'
import { useUnsavedChangesWarning } from './hooks/useUnsavedChangesWarning'
import { useHasAnyPending } from './hooks/useEffectiveTasks'
import { usePendingChangesStore } from './stores/pendingChangesStore'
import { useUIStore } from './stores/uiStore'
import { ru } from './locale/ru'
import type { Task } from './types'

function App() {
  const {
    data: projects = [],
    isLoading: loadingProjects,
    isError: projectsError,
    refetch: refetchProjects,
  } = useProjects()
  const selectedProjectId = useUIStore((s) => s.selectedProjectId)
  const setSelectedProjectId = useUIStore((s) => s.setSelectedProjectId)
  const projectEntered = useUIStore((s) => s.projectEntered)
  const enterProject = useUIStore((s) => s.enterProject)
  const exitProject = useUIStore((s) => s.exitProject)
  const viewMode = useUIStore((s) => s.viewMode)
  const selectedTaskId = useUIStore((s) => s.selectedTaskId)
  const showAuditModal = useUIStore((s) => s.showAuditModal)
  const hasPendingChanges = useHasAnyPending()
  const createProject = useCreateProject()
  const importProject = useImportProject()
  const [importError, setImportError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showComponents, setShowComponents] = useState(false)
  const [showReleases, setShowReleases] = useState(false)
  const [showGoals, setShowGoals] = useState(false)
  const clearPending = usePendingChangesStore((s) => s.clearAll)

  const handleExitProject = () => {
    clearPending()
    exitProject()
  }

  const activeProjectId =
    selectedProjectId && projects.some((p) => p.id === selectedProjectId)
      ? selectedProjectId
      : projects[0]?.id

  const handleSelectProject = (id: number) => {
    if (id !== selectedProjectId) clearPending()
    setSelectedProjectId(id)
  }

  const { data: project, isLoading: loadingProject } = useProject(activeProjectId ?? 0)
  const { stageStatusPromptModal } = useStageStatusPrompt(projectEntered ? project : undefined)

  useEffect(() => {
    if (!loadingProjects && projects.length && activeProjectId && activeProjectId !== selectedProjectId) {
      setSelectedProjectId(activeProjectId)
    }
  }, [loadingProjects, projects, activeProjectId, selectedProjectId, setSelectedProjectId])

  useUnsavedChangesWarning()

  if (loadingProjects && !projectsError) {
    return <div className="loading">{ru.loading}</div>
  }

  if (projectEntered && activeProjectId && loadingProject) {
    return <div className="loading">{ru.loading}</div>
  }

  if (!projectEntered) {
    return (
      <>
        <UserNameModal />
        <ProjectStartPage
          projects={projects}
          selectedProject={activeProjectId ? project ?? null : null}
          selectedProjectId={activeProjectId ?? null}
          loadingProject={Boolean(activeProjectId && loadingProject)}
          projectsError={projectsError}
          createError={createError}
          creating={createProject.isPending}
          importing={importProject.isPending}
          importError={importError}
          onRetryProjects={() => void refetchProjects()}
          onSelectProject={handleSelectProject}
          onCreateProject={(name, description) => {
            setCreateError(null)
            createProject.mutate(
              { name, description: description || null },
              {
                onSuccess: (created) => {
                  setSelectedProjectId(created.id)
                  setCreateError(null)
                },
                onError: (err) => {
                  setCreateError(err instanceof Error ? err.message : ru.startPage.createError)
                },
              }
            )
          }}
          onImportProject={(file, name, description) => {
            setImportError(null)
            importProject.mutate(
              { file, name, description },
              {
                onSuccess: (created) => {
                  setSelectedProjectId(created.id)
                  setImportError(null)
                },
                onError: (err) => {
                  setImportError(err instanceof Error ? err.message : ru.saveBar.failed)
                },
              }
            )
          }}
          onEnter={() => {
            if (activeProjectId) enterProject()
          }}
        />
      </>
    )
  }

  if (!project) {
    return (
      <>
        <UserNameModal />
        <div className="loading">
          {ru.noProject}{' '}
          <button type="button" className="link-btn" onClick={handleExitProject}>
            {ru.backToProjects}
          </button>
        </div>
      </>
    )
  }

  const selectedTask: Task | undefined = project.tasks.find((t) => t.id === selectedTaskId)

  return (
    <div className="app">
      <UserNameModal />
      <Toolbar
        projectName={project.name}
        onManageCategories={() => setShowCategories(true)}
        onManageComponents={() => setShowComponents(true)}
        onManageReleases={() => setShowReleases(true)}
        onManageGoals={() => setShowGoals(true)}
        onExitProject={handleExitProject}
      />
      <main className={`main ${selectedTask ? 'with-drawer' : ''} ${hasPendingChanges ? 'has-save-bar' : ''}`}>
        {viewMode === 'gantt' && <GanttView project={project} />}
        {viewMode === 'timeline' && <TimelineView project={project} />}
        {viewMode === 'kanban' && <KanbanView project={project} />}
        {viewMode === 'table' && <TableView project={project} />}
        {viewMode === 'backlog' && <BacklogView project={project} />}
        {viewMode === 'release_board' && <ReleaseBoardView project={project} />}
      </main>
      {selectedTask && <TaskDrawer project={project} task={selectedTask} />}
      {showCategories && (
        <CategoryManager project={project} onClose={() => setShowCategories(false)} />
      )}
      {showComponents && (
        <ComponentManager project={project} onClose={() => setShowComponents(false)} />
      )}
      {showReleases && (
        <ReleaseManager project={project} onClose={() => setShowReleases(false)} />
      )}
      {showGoals && (
        <GoalManager project={project} onClose={() => setShowGoals(false)} />
      )}
      {showAuditModal && <AuditModal projectId={project.id} />}
      {stageStatusPromptModal}
      <SaveChangesBar projectId={project.id} />
    </div>
  )
}

export default App
