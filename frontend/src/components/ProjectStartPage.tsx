import { useState } from 'react'
import { ru } from '../locale/ru'
import type { Project, ProjectDetail } from '../types'

interface Props {
  projects: Project[]
  selectedProject: ProjectDetail | null
  selectedProjectId: number | null
  loadingProject?: boolean
  creating?: boolean
  onSelectProject: (id: number) => void
  onCreateProject: (name: string, description: string) => void
  onEnter: () => void
}

export function ProjectStartPage({
  projects,
  selectedProject,
  selectedProjectId,
  loadingProject,
  creating,
  onSelectProject,
  onCreateProject,
  onEnter,
}: Props) {
  const [showCreate, setShowCreate] = useState(projects.length === 0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const taskCount = selectedProject?.tasks.length ?? 0
  const categoryCount = selectedProject?.categories.length ?? 0
  const inProgress =
    selectedProject?.tasks.filter((t) => t.status === 'in_progress').length ?? 0

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || creating) return
    onCreateProject(name.trim(), description.trim())
    setName('')
    setDescription('')
    setShowCreate(false)
  }

  return (
    <div className="start-page">
      <div className="start-page-layout">
        <section className="start-page-card start-page-list-card">
          <p className="start-page-eyebrow">{ru.startPage.eyebrow}</p>
          <h1 className="start-page-heading">{ru.startPage.heading}</h1>

          <ul className="start-page-projects">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`start-page-project-item ${selectedProjectId === p.id ? 'selected' : ''}`}
                  onClick={() => onSelectProject(p.id)}
                >
                  <span className="start-page-project-name">{p.name}</span>
                  {p.description && (
                    <span className="start-page-project-desc">{p.description}</span>
                  )}
                </button>
              </li>
            ))}
            {!projects.length && <li className="start-page-empty">{ru.startPage.empty}</li>}
          </ul>

          <button
            type="button"
            className="start-page-secondary"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? ru.startPage.cancel : ru.startPage.newProject}
          </button>

          {showCreate && (
            <form className="start-page-create" onSubmit={submitCreate}>
              <label>
                {ru.startPage.projectName}
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={ru.startPage.projectNamePlaceholder}
                  required
                />
              </label>
              <label>
                {ru.startPage.description}
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={ru.startPage.descriptionPlaceholder}
                  rows={2}
                />
              </label>
              <button type="submit" className="start-page-enter" disabled={creating || !name.trim()}>
                {creating ? ru.startPage.creating : ru.startPage.create}
              </button>
            </form>
          )}
        </section>

        <section className="start-page-card start-page-preview-card">
          {selectedProjectId && loadingProject && (
            <p className="start-page-muted">{ru.startPage.loadingProject}</p>
          )}
          {selectedProject && (
            <>
              <p className="start-page-eyebrow">{ru.startPage.selected}</p>
              <h2 className="start-page-title">{selectedProject.name}</h2>
              {selectedProject.description && (
                <p className="start-page-description">{selectedProject.description}</p>
              )}

              <dl className="start-page-stats">
                <div>
                  <dt>{ru.startPage.stats.tasks}</dt>
                  <dd>{taskCount}</dd>
                </div>
                <div>
                  <dt>{ru.startPage.stats.categories}</dt>
                  <dd>{categoryCount}</dd>
                </div>
                <div>
                  <dt>{ru.startPage.stats.inProgress}</dt>
                  <dd>{inProgress}</dd>
                </div>
              </dl>

              <button type="button" className="start-page-enter" onClick={onEnter}>
                {ru.startPage.open}
              </button>
            </>
          )}
          {!selectedProjectId && !loadingProject && (
            <p className="start-page-muted">{ru.startPage.selectHint}</p>
          )}
        </section>
      </div>
    </div>
  )
}
