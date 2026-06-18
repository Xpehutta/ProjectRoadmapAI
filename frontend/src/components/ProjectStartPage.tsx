import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { ru } from '../locale/ru'
import type { Project, ProjectDetail } from '../types'

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.json']

function isAcceptedFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function nameFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').trim()
  return base || ru.startPage.projectNamePlaceholder
}

interface Props {
  projects: Project[]
  selectedProject: ProjectDetail | null
  selectedProjectId: number | null
  loadingProject?: boolean
  projectsError?: boolean
  createError?: string | null
  creating?: boolean
  importing?: boolean
  importError?: string | null
  onSelectProject: (id: number) => void
  onCreateProject: (name: string, description: string) => void
  onImportProject: (file: File, name: string, description: string) => void
  onRetryProjects?: () => void
  onEnter: () => void
}

export function ProjectStartPage({
  projects,
  selectedProject,
  selectedProjectId,
  loadingProject,
  projectsError,
  createError,
  creating,
  importing,
  importError,
  onSelectProject,
  onCreateProject,
  onImportProject,
  onRetryProjects,
  onEnter,
}: Props) {
  const [showCreate, setShowCreate] = useState(projects.length === 0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [importName, setImportName] = useState('')
  const [importDescription, setImportDescription] = useState('')
  const [localImportError, setLocalImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wasImportingRef = useRef(false)

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

  const selectFile = useCallback((file: File) => {
    if (!isAcceptedFile(file)) {
      setLocalImportError(ru.startPage.import.invalidType)
      return
    }
    setLocalImportError(null)
    setPendingFile(file)
    setImportName(nameFromFilename(file.name))
    setImportDescription('')
  }, [])

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) selectFile(file)
  }

  const submitImport = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingFile || importing || !importName.trim()) return
    onImportProject(pendingFile, importName.trim(), importDescription.trim())
  }

  const clearPendingFile = useCallback(() => {
    setPendingFile(null)
    setImportName('')
    setImportDescription('')
    setLocalImportError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  useEffect(() => {
    if (wasImportingRef.current && !importing && !importError) {
      clearPendingFile()
    }
    wasImportingRef.current = Boolean(importing)
  }, [importing, importError, clearPendingFile])

  const displayImportError = localImportError || importError

  return (
    <div className="start-page">
      <div className="start-page-layout">
        <section className="start-page-card start-page-list-card">
          <p className="start-page-eyebrow">{ru.startPage.eyebrow}</p>
          <h1 className="start-page-heading">{ru.startPage.heading}</h1>

          {projectsError && (
            <div className="start-page-api-error" role="alert">
              <p>{ru.startPage.apiError}</p>
              {onRetryProjects && (
                <button type="button" className="start-page-secondary inline" onClick={onRetryProjects}>
                  {ru.startPage.retry}
                </button>
              )}
            </div>
          )}

          <div
            className={`start-page-dropzone ${dragOver ? 'drag-over' : ''} ${pendingFile ? 'has-file' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!pendingFile) fileInputRef.current?.click()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (!pendingFile) fileInputRef.current?.click()
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={ru.startPage.import.title}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json"
              className="start-page-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) selectFile(file)
              }}
            />
            <p className="start-page-dropzone-title">{ru.startPage.import.title}</p>
            <p className="start-page-dropzone-hint">
              {dragOver ? ru.startPage.import.dropHint : ru.startPage.import.hint}
            </p>
            <p className="start-page-dropzone-formats">{ru.startPage.import.formats}</p>
          </div>

          {pendingFile && (
            <form className="start-page-import-form" onSubmit={submitImport}>
              <p className="start-page-import-file">{ru.startPage.import.selectedFile(pendingFile.name)}</p>
              <label>
                {ru.startPage.import.nameFromFile}
                <input
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  required
                />
              </label>
              <label>
                {ru.startPage.description}
                <textarea
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  placeholder={ru.startPage.descriptionPlaceholder}
                  rows={2}
                />
              </label>
              {displayImportError && (
                <p className="start-page-import-error">{displayImportError}</p>
              )}
              <div className="start-page-import-actions">
                <button
                  type="button"
                  className="start-page-secondary inline"
                  onClick={clearPendingFile}
                  disabled={importing}
                >
                  {ru.startPage.import.cancelFile}
                </button>
                <button
                  type="submit"
                  className="start-page-enter"
                  disabled={importing || !importName.trim()}
                >
                  {importing ? ru.startPage.import.importing : ru.startPage.import.importButton}
                </button>
              </div>
            </form>
          )}

          {!pendingFile && displayImportError && (
            <p className="start-page-import-error">{displayImportError}</p>
          )}

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
              {createError && <p className="start-page-import-error">{createError}</p>}
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
