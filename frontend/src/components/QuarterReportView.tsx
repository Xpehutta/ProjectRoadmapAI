import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { ru } from '../locale/ru'
import { useSavedDateShiftsStore } from '../stores/savedDateShiftsStore'
import { useUIStore } from '../stores/uiStore'
import type { ProjectDetail } from '../types'
import {
  buildQuarterReport,
  compactQuarterReport,
  currentQuarter,
  formatQuarterLabel,
  type Quarter,
  type QuarterReportBriefLine,
} from '../utils/quarterReport'

interface Props {
  project: ProjectDetail
}

const QUARTERS: Quarter[] = [1, 2, 3, 4]

function BriefColumn({
  title,
  count,
  lines,
  empty,
  onOpenTask,
}: {
  title: string
  count: number
  lines: QuarterReportBriefLine[]
  empty: string
  onOpenTask: (taskId: number) => void
}) {
  return (
    <section className="quarter-report-col">
      <h3>
        {title} <span className="quarter-report-count">{count}</span>
      </h3>
      {lines.length === 0 ? (
        <p className="muted quarter-report-empty">{empty}</p>
      ) : (
        <ul className="quarter-report-lines">
          {lines.map((row, i) => (
            <li key={`${row.taskId}-${i}`}>
              {row.taskId > 0 ? (
                <button type="button" className="link-btn quarter-report-line-btn" onClick={() => onOpenTask(row.taskId)}>
                  {row.line}
                </button>
              ) : (
                <span>{row.line}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function QuarterReportView({ project }: Props) {
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const initial = currentQuarter()
  const [year, setYear] = useState(initial.year)
  const [quarter, setQuarter] = useState<Quarter>(initial.quarter)

  const savedTaskShifts = useSavedDateShiftsStore((s) => s.taskShifts)
  const savedStageShifts = useSavedDateShiftsStore((s) => s.stageShifts)

  const { data: auditEvents = [], isLoading } = useQuery({
    queryKey: ['audit', project.id, 'dates'],
    queryFn: () => api.getProjectAudit(project.id, 'dates'),
  })

  const brief = useMemo(() => {
    const report = buildQuarterReport({
      project,
      year,
      quarter,
      auditEvents,
      savedTaskShifts,
      savedStageShifts,
      savedMilestoneShifts: {},
    })
    return { report, lines: compactQuarterReport(report) }
  }, [project, year, quarter, auditEvents, savedTaskShifts, savedStageShifts])

  const openTask = (taskId: number) => {
    if (taskId > 0) setSelectedTaskId(taskId)
  }

  const period = formatQuarterLabel(year, quarter)

  return (
    <div className="quarter-report-view">
      <article className="quarter-report-sheet">
        <header className="quarter-report-header">
          <div className="quarter-report-header-main">
            <h2>{project.name}</h2>
            <p className="quarter-report-period">{ru.quarterReport.pageTitle(period)}</p>
          </div>
          <div className="quarter-report-controls">
            <input
              type="number"
              className="quarter-report-year"
              min={2000}
              max={2100}
              value={year}
              aria-label={ru.quarterReport.year}
              onChange={(e) => setYear(Number(e.target.value) || initial.year)}
            />
            <div className="filter-chips quarter-report-quarters">
              {QUARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={quarter === q ? 'active' : ''}
                  onClick={() => setQuarter(q)}
                >
                  {ru.quarterReport.quarterButton(q)}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="quarter-report-columns">
          <BriefColumn
            title={ru.quarterReport.doneTitle}
            count={brief.report.done.length}
            lines={brief.lines.done}
            empty={ru.quarterReport.emptyDone}
            onOpenTask={openTask}
          />
          <BriefColumn
            title={ru.quarterReport.planTitle}
            count={brief.lines.plan.length}
            lines={brief.lines.plan}
            empty={ru.quarterReport.emptyPlan}
            onOpenTask={openTask}
          />
          <BriefColumn
            title={ru.quarterReport.shiftsTitle}
            count={brief.lines.shifts.length}
            lines={brief.lines.shifts}
            empty={ru.quarterReport.emptyShifts}
            onOpenTask={openTask}
          />
        </div>

        {isLoading && <p className="muted quarter-report-loading">{ru.loading}</p>}
      </article>
    </div>
  )
}
