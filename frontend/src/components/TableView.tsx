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
import { ru, STATUS_OPTIONS } from '../locale/ru'

const STATUSES = STATUS_OPTIONS.map((s) => s.id)
const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.id, s.label])) as Record<
  TaskStatus,
  string
>

function textCell(
  task: Task,
  field: keyof Task,
  stageFn: (task: Task, field: string, value: unknown) => void,
  multiline = false
) {
  const value = task[field]
  return multiline ? (
    <textarea
      className="cell-input"
      key={`${field}-${task.id}-${value}`}
      defaultValue={(value as string) ?? ''}
      rows={2}
      onBlur={(e) => stageFn(task, field, e.target.value || null)}
    />
  ) : (
    <input
      className="cell-input"
      key={`${field}-${task.id}-${value}`}
      defaultValue={(value as string) ?? ''}
      onBlur={(e) => stageFn(task, field, e.target.value || null)}
    />
  )
}

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
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)

  const baseTasksById = useMemo(() => new Map(project.tasks.map((t) => [t.id, t])), [project.tasks])

  const handleDeleteTask = useCallback(
    async (task: Task) => {
      if (!confirm(ru.drawer.deleteTaskConfirm(task.name))) return
      setError(null)
      setDeletingTaskId(task.id)
      try {
        await deleteTask.mutateAsync(task.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : ru.saveBar.failed)
      } finally {
        setDeletingTaskId(null)
      }
    },
    [deleteTask]
  )

  const openTaskDrawer = useCallback(
    (taskId: number, e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, select, textarea, button')) return
      setSelectedTaskId(taskId)
    },
    [setSelectedTaskId]
  )

  const stage = (task: Task, field: string, value: unknown) => {
    setError(null)
    const base = baseTasksById.get(task.id) ?? task
    if (field === 'predecessors') {
      stageTaskChange(base, { predecessor_refs: value })
      return
    }
    stageTaskChange(base, { [field]: value })
  }

  const columnHelper = createColumnHelper<Task>()

  const columns = useMemo(
    () => [
      columnHelper.accessor('priority', {
        header: 'Приоритет',
        cell: (info) => (
          <input
            type="number"
            className="cell-input narrow"
            key={`pri-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue() ?? ''}
            onBlur={(e) =>
              stage(info.row.original, 'priority', e.target.value ? Number(e.target.value) : null)
            }
          />
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Статус',
        cell: (info) => (
          <select
            key={`st-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue()}
            onChange={(e) => stage(info.row.original, 'status', e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ),
      }),
      columnHelper.accessor('category_id', {
        header: 'БВ',
        cell: (info) => (
          <select
            key={`cat-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue() ?? ''}
            onChange={(e) =>
              stage(info.row.original, 'category_id', e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">—</option>
            {project.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ),
      }),
      columnHelper.accessor('name', {
        header: ru.table.usage,
        cell: (info) => (
          <input
            className={`cell-input ${pendingIds.has(info.row.original.id) ? 'pending' : ''}`}
            key={`name-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue()}
            onBlur={(e) => {
              if (e.target.value !== info.getValue()) stage(info.row.original, 'name', e.target.value)
            }}
          />
        ),
      }),
      columnHelper.accessor('data_source', {
        header: 'Источник',
        cell: (info) => {
          const t = info.row.original
          const label = displayDataSource(t)
          return (
            <div className="table-source-cell">
              <strong>{label}</strong>
              {t.subproduct && (
                <span className="muted table-source-sub">{t.subproduct}</span>
              )}
              {t.component_id && t.component_usage_count > 1 && (
                <span className="badge shared-badge" title={ru.table.sharedSource}>
                  {ru.components.sharedBadge}
                </span>
              )}
            </div>
          )
        },
      }),
      columnHelper.accessor('subproduct', {
        header: 'Субпродукт',
        cell: (info) => textCell(info.row.original, 'subproduct', stage),
      }),
      columnHelper.accessor('forms', {
        header: 'Формы',
        cell: (info) => textCell(info.row.original, 'forms', stage),
      }),
      columnHelper.accessor('customer', {
        header: 'Заказчик',
        cell: (info) => textCell(info.row.original, 'customer', stage),
      }),
      columnHelper.accessor('platform', {
        header: 'Площадка',
        cell: (info) => textCell(info.row.original, 'platform', stage),
      }),
      columnHelper.accessor('area', {
        header: 'Область',
        cell: (info) => textCell(info.row.original, 'area', stage),
      }),
      columnHelper.accessor('assignee', {
        header: 'Команда',
        cell: (info) => textCell(info.row.original, 'assignee', stage),
      }),
      columnHelper.accessor('contractor', {
        header: 'Подрядчик',
        cell: (info) => textCell(info.row.original, 'contractor', stage),
      }),
      columnHelper.accessor('desired_quarter', {
        header: 'Срок',
        cell: (info) => textCell(info.row.original, 'desired_quarter', stage),
      }),
      columnHelper.accessor('attribute_count', {
        header: 'Атрибуты',
        cell: (info) => textCell(info.row.original, 'attribute_count', stage),
      }),
      columnHelper.accessor('start_date', {
        header: 'Начало',
        cell: (info) => {
          const base = baseTasksById.get(info.row.original.id) ?? info.row.original
          return (
            <TableDateCell
              baseTask={base}
              value={info.getValue()}
              showShift={false}
              onBlur={(v) => stage(info.row.original, 'start_date', v)}
            />
          )
        },
      }),
      columnHelper.accessor('end_date', {
        header: 'Окончание',
        cell: (info) => {
          const base = baseTasksById.get(info.row.original.id) ?? info.row.original
          const task = info.row.original
          return (
            <TableDateCell
              baseTask={base}
              value={info.getValue()}
              indicativeHint={showIndicative ? task.indicative_end : null}
              showShift
              onBlur={(v) => stage(info.row.original, 'end_date', v)}
            />
          )
        },
      }),
      columnHelper.accessor('indicative_start', {
        header: 'Инд. начало',
        cell: (info) => (
          <input
            type="date"
            className="cell-input"
            key={`is-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue() ?? ''}
            onBlur={(e) => stage(info.row.original, 'indicative_start', e.target.value || null)}
          />
        ),
      }),
      columnHelper.accessor('indicative_end', {
        header: 'Инд. окончание',
        cell: (info) => (
          <input
            type="date"
            className="cell-input"
            key={`ie-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue() ?? ''}
            onBlur={(e) => stage(info.row.original, 'indicative_end', e.target.value || null)}
          />
        ),
      }),
      columnHelper.accessor('duration_days', {
        header: 'Длительность',
        cell: (info) => (
          <input
            type="number"
            className="cell-input narrow"
            key={`dur-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue() ?? ''}
            onBlur={(e) =>
              stage(
                info.row.original,
                'duration_days',
                e.target.value ? Number(e.target.value) : null
              )
            }
          />
        ),
      }),
      columnHelper.accessor('completion_pct', {
        header: '%',
        cell: (info) => <span>{info.getValue()}%</span>,
      }),
      columnHelper.accessor('risks', {
        header: 'Риски',
        cell: (info) => textCell(info.row.original, 'risks', stage, true),
      }),
      columnHelper.accessor('notes', {
        header: 'Комментарий',
        cell: (info) => textCell(info.row.original, 'notes', stage, true),
      }),
      columnHelper.accessor('planned_cost', {
        header: ru.table.plannedCost,
        cell: (info) => (
          <input
            className="cell-input narrow"
            key={`pc-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue() ?? ''}
            onBlur={(e) => stage(info.row.original, 'planned_cost', e.target.value || null)}
          />
        ),
      }),
      columnHelper.accessor('actual_cost', {
        header: ru.table.actualCost,
        cell: (info) => (
          <input
            className="cell-input narrow"
            key={`ac-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue() ?? ''}
            onBlur={(e) => stage(info.row.original, 'actual_cost', e.target.value || null)}
          />
        ),
      }),
      columnHelper.accessor('planned_effort', {
        header: ru.table.plannedEffort,
        cell: (info) => (
          <input
            className="cell-input narrow"
            key={`pe-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue() ?? ''}
            onBlur={(e) => stage(info.row.original, 'planned_effort', e.target.value || null)}
          />
        ),
      }),
      columnHelper.accessor('actual_effort', {
        header: ru.table.actualEffort,
        cell: (info) => (
          <input
            className="cell-input narrow"
            key={`ae-${info.row.original.id}-${info.getValue()}`}
            defaultValue={info.getValue() ?? ''}
            onBlur={(e) => stage(info.row.original, 'actual_effort', e.target.value || null)}
          />
        ),
      }),
      columnHelper.display({
        id: 'predecessors',
        header: ru.table.predecessors,
        cell: ({ row }) => {
          const refs =
            (taskChanges[row.original.id]?.patch.predecessor_refs as string) ??
            row.original.predecessors.map((p) => p.name).join(', ')
          return (
            <input
              className="cell-input"
              key={`pred-${row.original.id}-${refs}`}
              defaultValue={refs}
              placeholder={ru.table.predecessorsPlaceholder}
              onBlur={(e) => stage(row.original, 'predecessors', e.target.value)}
            />
          )
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const task = row.original
          const isDeleting = deletingTaskId === task.id
          return (
            <button
              type="button"
              className="btn-danger btn-table-delete"
              title={ru.table.deleteTask}
              disabled={isDeleting || deleteTask.isPending}
              onClick={(e) => {
                e.stopPropagation()
                void handleDeleteTask(task)
              }}
            >
              {isDeleting ? '…' : '✕'}
            </button>
          )
        },
      }),
    ],
    [
      project.categories,
      effectiveTasks,
      pendingIds,
      taskChanges,
      baseTasksById,
      showIndicative,
      deletingTaskId,
      deleteTask.isPending,
      handleDeleteTask,
    ]
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
    const today = new Date().toISOString().slice(0, 10)
    await createTask.mutateAsync({
      name: ru.table.newTask,
      start_date: today,
      end_date: today,
      status: 'todo',
      category_id: project.categories[0]?.id ?? null,
    })
  }

  return (
    <div className="table-view">
      {error && <div className="error-banner">{error}</div>}
      <div className="table-actions">
        <button onClick={addRow}>{ru.table.addTask}</button>
        <span className="table-hint">{ru.table.hint}</span>
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
                    className={pendingIds.has(row!.original.id) ? 'row-pending' : ''}
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
                      <td
                        key={cell.id}
                        className={cell.column.id === 'actions' ? 'table-actions-cell' : undefined}
                        onClick={
                          cell.column.id === 'actions'
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
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
