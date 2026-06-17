import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { ru } from '../locale/ru'
import type { ProjectDetail, TableColumnSchema } from '../types'

interface Props {
  project: ProjectDetail
  onClose: () => void
}

const CORE_KEYS = new Set(['status', 'name'])

export function TableColumnManager({ project, onClose }: Props) {
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [builtinKey, setBuiltinKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['table-columns', project.id],
    queryFn: () => api.getTableColumns(project.id),
  })

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['table-columns', project.id] })
    await qc.invalidateQueries({ queryKey: ['project', project.id] })
  }

  const addCustom = useMutation({
    mutationFn: (columnLabel: string) =>
      api.addTableColumn(project.id, { label: columnLabel }),
    onSuccess: () => {
      setLabel('')
      setError(null)
      void invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  const addBuiltin = useMutation({
    mutationFn: (key: string) => api.addTableColumn(project.id, { builtin_key: key }),
    onSuccess: () => {
      setBuiltinKey('')
      setError(null)
      void invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (col: TableColumnSchema) => api.deleteTableColumn(project.id, col.key),
    onSuccess: () => {
      setError(null)
      void invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleRemove = (col: TableColumnSchema) => {
    const message =
      col.source === 'custom'
        ? ru.tableColumns.deleteCustomConfirm(col.label)
        : ru.tableColumns.deleteBuiltinConfirm(col.label)
    if (!confirm(message)) return
    remove.mutate(col)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{ru.tableColumns.title}</h2>
        <p className="muted">{ru.tableColumns.description}</p>
        {error && <div className="error-banner">{error}</div>}

        {isLoading ? (
          <p>{ru.tableColumns.loading}</p>
        ) : (
          <>
            <ul className="column-list">
              {(data?.columns ?? []).map((col) => (
                <li key={col.key}>
                  <span className="column-list-label">{col.label}</span>
                  <span className={`badge ${col.source === 'custom' ? 'badge-custom' : 'badge-builtin'}`}>
                    {col.source === 'custom' ? ru.tableColumns.customBadge : ru.tableColumns.builtinBadge}
                  </span>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={CORE_KEYS.has(col.key) || remove.isPending}
                    title={CORE_KEYS.has(col.key) ? ru.tableColumns.requiredColumn : undefined}
                    onClick={() => handleRemove(col)}
                  >
                    {ru.tableColumns.delete}
                  </button>
                </li>
              ))}
            </ul>

            <form
              className="column-form"
              onSubmit={(e) => {
                e.preventDefault()
                const trimmed = label.trim()
                if (!trimmed) return
                addCustom.mutate(trimmed)
              }}
            >
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={ru.tableColumns.newPlaceholder}
              />
              <button type="submit" disabled={!label.trim() || addCustom.isPending}>
                {addCustom.isPending ? ru.tableColumns.adding : ru.tableColumns.addCustom}
              </button>
            </form>

            {(data?.hidden_builtin.length ?? 0) > 0 && (
              <form
                className="column-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!builtinKey) return
                  addBuiltin.mutate(builtinKey)
                }}
              >
                <select value={builtinKey} onChange={(e) => setBuiltinKey(e.target.value)}>
                  <option value="">{ru.tableColumns.addBuiltinPlaceholder}</option>
                  {data!.hidden_builtin.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.label}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={!builtinKey || addBuiltin.isPending}>
                  {addBuiltin.isPending ? ru.tableColumns.adding : ru.tableColumns.addBuiltin}
                </button>
              </form>
            )}
          </>
        )}

        <button type="button" onClick={onClose}>
          {ru.tableColumns.close}
        </button>
      </div>
    </div>
  )
}
