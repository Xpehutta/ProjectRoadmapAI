import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { DateShiftIndicator } from './DateShiftIndicator'
import { useCreateTask, useDeleteTask } from '../hooks/useProject'
import { useEffectiveTasks, usePendingTaskIds } from '../hooks/useEffectiveTasks'
import { useTaskDateShifts } from '../hooks/useTaskDateShift'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useUIStore } from '../stores/uiStore'
import type { ProjectDetail, Task, TaskStatus } from '../types'
import {
  buildTaskGroups,
  formatGroupDateRange,
  getGroupDateRangesFromTasks,
  getTaskCategoryColor,
} from '../utils/taskGroups'
import { displayDataSource } from '../utils/taskDisplay'
import {
  getTaskCellValue,
  resolveTableColumns,
  STATUS_LABELS,
  type TableColumnDef,
} from '../utils/tableColumns'
import { ru, STATUS_OPTIONS } from '../locale/ru'
import { TableColumnManager } from './TableColumnManager'

const STATUSES = STATUS_OPTIONS.map((s) => s.id)

function TableDateCell({
  baseTask,
  value,
  showShift,
  indicativeHint,
  onBlur,
}: {
  baseTask: Task
  value: string | null
  showShift: boolean
  indicativeHint?: string | null
  onBlur: (value: string | null) => void
}) {
  const dateShifts = useTaskDateShifts(baseTask)
  return (
    <div className="table-date-cell">
      <input
        type="date"
        className="cell-input"
        key={`${baseTask.id}-${value}-${indicativeHint ?? ''}`}
        defaultValue={value ?? ''}
        onBlur={(e) => onBlur(e.target.value || null)}
        onChange={(e) => onBlur(e.target.value || null)}
      />
      {indicativeHint && !value && (
        <span className="table-date-hint" title={ru.table.indicativeHint}>
          ~ {indicativeHint}
        </span>
      )}
      {showShift && (
        <DateShiftIndicator
          shifts={dateShifts}
          entityKey={`task-${baseTask.id}`}
          entityLabel={baseTask.name}
          compact
        />
      )}
    </div>
  )
}

interface Props {
  project: ProjectDetail
}

export function TableView({ project }: Props) {
  const createTask = useCreateTask(project.id)
  const deleteTask = useDeleteTask(project.id)
  const selectedTaskId = useUIStore((s) => s.selectedTaskId)
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const groupingMode = useUIStore((s) => s.groupingMode)
  const showIndicative = useUIStore((s) => s.showIndicative)
  const collapsedGroupKeys = useUIStore((s) => s.collapsedGroupKeys)
  const toggleGroupCollapsed = useUIStore((s) => s.toggleGroupCollapsed)
  const stageTaskChange = usePendingChangesStore((s) => s.stageTaskChange)
  const taskChanges = usePendingChangesStore((s) => s.taskChanges)
  const effectiveTasks = useEffectiveTasks(project.tasks)
  const pendingIds = usePendingTaskIds(project.tasks)
  const [error, setError] = useState<string | null>(null)
  const [showColumnManager, setShowColumnManager] = useState(false)

  const baseTasksById = useMemo(() => new Map(project.tasks.map((t) => [t.id, t])), [project.tasks])
  const tableColumns = useMemo(
    () => resolveTableColumns(project, effectiveTasks),
    [project, effectiveTasks]
  )

  const selectedTask = useMemo(
    () => (selectedTaskId ? project.tasks.find((t) => t.id === selectedTaskId) : undefined),
    [project.tasks, selectedTaskId]
  )

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedTask) return
    if (!confirm(ru.drawer.deleteTaskConfirm(selectedTask.name))) return
    setError(null)
    try {
      await deleteTask.mutateAsync(selectedTask.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : ru.saveBar.failed)
    }
  }, [deleteTask, selectedTask])

  const openTaskDrawer = useCallback(
    (taskId: number, e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, select, textarea, button')) return
      setSelectedTaskId(taskId)
    },
    [setSelectedTaskId]
  )

  const stageColumn = useCallback(
    (task: Task, col: TableColumnDef, value: unknown) => {
      setError(null)
      const base = baseTasksById.get(task.id) ?? task
      const pending = taskChanges[task.id]?.patch
      if (col.source === 'custom') {
        const mergedCustom = {
          ...(base.custom_fields ?? {}),
          ...((pending?.custom_fields as Record<string, string>) ?? {}),
          [col.key]: value ? String(value) : '',
        }
        stageTaskChange(base, { custom_fields: mergedCustom })
        return
      }

      if (col.key === 'predecessors') {
        stageTaskChange(base, { predecessor_refs: value })
        return
      }

      stageTaskChange(base, { [col.key]: value })
    },
    [baseTasksById, stageTaskChange, taskChanges]
  )

  const renderCell = useCallback(
    (task: Task, col: TableColumnDef) => {
      const effective = task
      const base = baseTasksById.get(task.id) ?? task
      const pending = taskChanges[task.id]?.patch
      const value = getTaskCellValue(effective, col)

      if (col.key === 'data_source' && col.source === 'builtin') {
        const label = displayDataSource(effective)
        return (
          <div className="table-source-cell">
            <strong>{label}</strong>
            {effective.subproduct && (
              <span className="muted table-source-sub">{effective.subproduct}</span>
            )}
            {effective.component_id && effective.component_usage_count > 1 && (
              <span className="badge shared-badge" title={ru.table.sharedSource}>
                {ru.components.sharedBadge}
              </span>
            )}
          </div>
        )
      }

      if (col.type === 'status') {
        return (
          <select
            key={`st-${task.id}-${value}`}
            defaultValue={String(value ?? 'todo')}
            onChange={(e) => stageColumn(base, col, e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s as TaskStatus]}
              </option>
            ))}
          </select>
        )
      }

      if (col.type === 'category') {
        return (
          <select
            key={`cat-${task.id}-${value}`}
            defaultValue={effective.category_id ?? ''}
            onChange={(e) =>
              stageColumn(base, col, e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">—</option>
            {project.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )
      }

      if (col.type === 'date') {
        const showShift = col.key === 'end_date'
        const indicativeHint =
          col.key === 'end_date' && showIndicative ? effective.indicative_end : null
        return (
          <TableDateCell
            baseTask={base}
            value={(value as string | null) ?? null}
            showShift={showShift}
            indicativeHint={indicativeHint}
        onBlur={(v) => stageColumn(base, col, v)}
          />
        )
      }

      if (col.type === 'number') {
        return (
          <input
            type="number"
            className="cell-input narrow"
            key={`${col.key}-${task.id}-${value}`}
            defaultValue={value == null || value === '' ? '' : String(value)}
            onBlur={(e) =>
              stageColumn(
                base,
                col,
                e.target.value ? Number(e.target.value) : null
              )
            }
          />
        )
      }

      if (col.type === 'readonly') {
        if (col.key === 'completion_pct') {
          return <span>{effective.completion_pct}%</span>
        }
        return <span>{value == null ? '' : String(value)}</span>
      }

      if (col.key === 'predecessors') {
        const refs =
          (pending?.predecessor_refs as string) ??
          effective.predecessors.map((p) => p.name).join(', ')
        return (
          <input
            className="cell-input"
            key={`pred-${task.id}-${refs}`}
            defaultValue={refs}
            placeholder={ru.table.predecessorsPlaceholder}
            onBlur={(e) => stageColumn(base, col, e.target.value)}
          />
        )
      }

      if (col.key === 'name') {
        return (
          <input
            className={`cell-input ${pendingIds.has(task.id) ? 'pending' : ''}`}
            key={`name-${task.id}-${value}`}
            defaultValue={String(value ?? '')}
            onBlur={(e) => {
              if (e.target.value !== value) stageColumn(base, col, e.target.value)
            }}
          />
        )
      }

      const multiline = col.type === 'textarea'
      return multiline ? (
        <textarea
          className="cell-input"
          key={`${col.key}-${task.id}-${value}`}
          defaultValue={String(value ?? '')}
          rows={2}
          onBlur={(e) => stageColumn(base, col, e.target.value || null)}
        />
      ) : (
        <input
          className="cell-input"
          key={`${col.key}-${task.id}-${value}`}
          defaultValue={String(value ?? '')}
          onBlur={(e) => stageColumn(base, col, e.target.value || null)}
        />
      )
    },
    [
      baseTasksById,
      pendingIds,
      project.categories,
      showIndicative,
      stageColumn,
      taskChanges,
    ]
  )

  const columnHelper = createColumnHelper<Task>()

  const columns = useMemo(
    () =>
      tableColumns.map((col) =>
        columnHelper.display({
          id: col.key,
          header: col.label,
          cell: ({ row }) => renderCell(row.original, col),
        })
      ),
    [tableColumns, renderCell]
  )

  const table = useReactTable({
    data: effectiveTasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  })

  const taskGroups = useMemo(
    () => buildTaskGroups(effectiveTasks, project.categories, groupingMode),
    [effectiveTasks, project.categories, groupingMode]
  )

  const taskRowsById = useMemo(() => {
    const map = new Map<number, ReturnType<typeof table.getRowModel>['rows'][number]>()
    for (const row of table.getRowModel().rows) {
      map.set(row.original.id, row)
    }
    return map
  }, [table, effectiveTasks])

  const columnCount = table.getAllColumns().length

  const addRow = async () => {
    setError(null)
    try {
      const task = await createTask.mutateAsync({
        name: ru.table.newTask,
        status: 'todo',
        category_id: project.categories[0]?.id ?? null,
      })
      setSelectedTaskId(task.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : ru.saveBar.failed)
    }
  }

  const isAdaptive = !project.table_schema?.length

  return (
    <div className="table-view">
      {showColumnManager && (
        <TableColumnManager project={project} onClose={() => setShowColumnManager(false)} />
      )}
      {error && <div className="error-banner">{error}</div>}
      <div className="table-actions">
        <button type="button" onClick={addRow}>
          {ru.table.addTask}
        </button>
        <button type="button" onClick={() => setShowColumnManager(true)}>
          {ru.table.manageColumns}
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={!selectedTask || deleteTask.isPending}
          title={selectedTask ? ru.table.deleteTask : ru.table.selectRowToDelete}
          onClick={() => void handleDeleteSelected()}
        >
          {deleteTask.isPending ? ru.table.deletingTask : ru.table.deleteTask}
        </button>
        {selectedTask && (
          <span className="table-selected-hint">{ru.table.selectedRow(selectedTask.name)}</span>
        )}
        <span className="table-hint">
          {isAdaptive ? ru.table.adaptiveHint : ru.table.hint}
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {taskGroups.flatMap((group) => {
              const isSwimlane = groupingMode === 'swimlane'
              const collapsed = isSwimlane && collapsedGroupKeys.includes(group.key)
              const groupRanges = collapsed ? getGroupDateRangesFromTasks(group.tasks) : null
              const header = isSwimlane ? (
                <tr
                  key={`group-${group.key}`}
                  className="table-group-row"
                  onClick={() => toggleGroupCollapsed(group.key)}
                >
                  <td colSpan={columnCount}>
                    <span
                      className="table-group-label"
                      style={{ borderLeftColor: group.color || '#64748b' }}
                    >
                      {collapsed ? '▸' : '▾'} {group.label}
                      <span className="table-group-count">{group.tasks.length}</span>
                      {groupRanges && (groupRanges.actual || groupRanges.indicative) && (
                        <span className="table-group-dates">
                          {groupRanges.actual && (
                            <span className="table-group-dates-actual">
                              {ru.table.groupActual} {formatGroupDateRange(groupRanges.actual)}
                            </span>
                          )}
                          {groupRanges.indicative && (
                            <span className="table-group-dates-indicative">
                              {ru.table.groupIndicative}{' '}
                              {formatGroupDateRange(groupRanges.indicative)}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ) : null

              if (collapsed) return [header].filter(Boolean)

              const rows = group.tasks
                .map((task) => taskRowsById.get(task.id) ?? table.getRow(String(task.id)))
                .filter(Boolean)
                .map((row) => (
                  <tr
                    key={row!.id}
                    className={[
                      pendingIds.has(row!.original.id) ? 'row-pending' : '',
                      selectedTaskId === row!.original.id ? 'row-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      !isSwimlane
                        ? {
                            borderLeft: `4px solid ${getTaskCategoryColor(row!.original, project.categories)}`,
                          }
                        : undefined
                    }
                    onClick={(e) => openTaskDrawer(row!.original.id, e)}
                  >
                    {row!.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))

              return header ? [header, ...rows] : rows
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
