import type { AuditEvent, ProjectDetail, Task } from '../types'
import type {
  SavedMilestoneDateShift,
  SavedStageDateShift,
  SavedTaskDateShift,
} from '../stores/savedDateShiftsStore'
import { parseDate, daysBetween } from './dateShift'
import { isStagePlanned, stagePlannedDates } from './stageComplete'
import { sortedSubStages, stageEffectiveEndDate } from './subStageDates'

export type Quarter = 1 | 2 | 3 | 4

const STAGE_FIELD_RE = /^sub_stage:(\d+):(.+)\.(start_date|end_date)$/

export interface QuarterReportDoneItem {
  taskId: number
  taskName: string
  showcase: string | null
  area: string | null
  kind: 'stage' | 'task'
  label: string
  date: string
}

export interface QuarterReportPlanItem {
  taskId: number
  taskName: string
  showcase: string | null
  area: string | null
  kind: 'stage' | 'task' | 'milestone'
  label: string
  startDate: string | null
  endDate: string | null
}

export interface QuarterReportShiftItem {
  taskId: number
  taskName: string
  showcase: string | null
  kind: 'stage' | 'task' | 'indicative'
  label: string
  oldValue: string | null
  newValue: string | null
  days: number | null
  at: string | null
  user: string | null
  comment?: string
}

export interface QuarterReport {
  year: number
  quarter: Quarter
  done: QuarterReportDoneItem[]
  plan: QuarterReportPlanItem[]
  shifts: QuarterReportShiftItem[]
}

export function currentQuarter(): { year: number; quarter: Quarter } {
  const now = new Date()
  const quarter = (Math.floor(now.getMonth() / 3) + 1) as Quarter
  return { year: now.getFullYear(), quarter }
}

export function quarterRange(year: number, quarter: Quarter): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, startMonth + 3, 0)
  return { start, end }
}

export function dateInQuarter(isoDate: string | null | undefined, year: number, quarter: Quarter): boolean {
  const d = parseDate(isoDate ?? null)
  if (!d) return false
  const { start, end } = quarterRange(year, quarter)
  return d >= start && d <= end
}

export function rangeOverlapsQuarter(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  year: number,
  quarter: Quarter
): boolean {
  const start = parseDate(startIso ?? null)
  const end = parseDate(endIso ?? null) ?? start
  if (!start && !end) return false
  const { start: qStart, end: qEnd } = quarterRange(year, quarter)
  const from = start ?? end!
  const to = end ?? start!
  return from <= qEnd && to >= qStart
}

export function desiredQuarterMatches(
  value: string | null | undefined,
  year: number,
  quarter: Quarter
): boolean {
  if (!value?.trim()) return false
  const v = value.trim()
  if (dateInQuarter(v, year, quarter)) return true
  const yearMatch = v.match(/\b(20\d{2})\b/)
  const qMatch = v.match(/Q\s*([1-4])|([1-4])\s*кв/i)
  if (!qMatch) return false
  const q = Number(qMatch[1] ?? qMatch[2]) as Quarter
  if (q !== quarter) return false
  if (!yearMatch) return true
  return Number(yearMatch[1]) === year
}

function taskMeta(task: Task, categories: ProjectDetail['categories']) {
  const area = task.area ?? categories.find((c) => c.id === task.category_id)?.name ?? null
  return {
    showcase: task.subproduct ?? task.component_name ?? task.data_source ?? null,
    area,
  }
}

function parseStageAuditField(field: string | null): { stageName: string; dateField: string } | null {
  if (!field) return null
  const m = field.match(STAGE_FIELD_RE)
  if (!m) return null
  return { stageName: m[2], dateField: m[3] }
}

function shiftDays(oldValue: string | null, newValue: string | null): number | null {
  const oldD = parseDate(oldValue)
  const newD = parseDate(newValue)
  if (!oldD || !newD) return null
  return daysBetween(oldD, newD)
}

function auditEventInQuarter(at: string, year: number, quarter: Quarter): boolean {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return false
  const { start, end } = quarterRange(year, quarter)
  end.setHours(23, 59, 59, 999)
  return d >= start && d <= end
}

function taskFieldLabel(field: string): string {
  switch (field) {
    case 'indicative_start':
      return 'индикативное начало'
    case 'indicative_end':
      return 'индикативное окончание'
    case 'start_date':
      return 'факт. начало'
    case 'end_date':
      return 'факт. окончание'
    default:
      return field
  }
}

function pushUniqueShift(list: QuarterReportShiftItem[], item: QuarterReportShiftItem) {
  const key = `${item.taskId}|${item.label}|${item.oldValue}|${item.newValue}|${item.at}`
  if (list.some((x) => `${x.taskId}|${x.label}|${x.oldValue}|${x.newValue}|${x.at}` === key)) return
  list.push(item)
}

export function buildQuarterReport(input: {
  project: ProjectDetail
  year: number
  quarter: Quarter
  auditEvents: AuditEvent[]
  savedTaskShifts: Record<number, SavedTaskDateShift[]>
  savedStageShifts: Record<number, SavedStageDateShift[]>
  savedMilestoneShifts: Record<number, SavedMilestoneDateShift[]>
}): QuarterReport {
  const { project, year, quarter, auditEvents } = input
  const tasksById = new Map(project.tasks.map((t) => [t.id, t]))
  const done: QuarterReportDoneItem[] = []
  const plan: QuarterReportPlanItem[] = []
  const shifts: QuarterReportShiftItem[] = []

  for (const task of project.tasks) {
    const meta = taskMeta(task, project.categories)

    if (task.status === 'done' && dateInQuarter(task.end_date, year, quarter)) {
      done.push({
        taskId: task.id,
        taskName: task.name,
        showcase: meta.showcase,
        area: meta.area,
        kind: 'task',
        label: 'Задача выполнена',
        date: task.end_date!,
      })
    }

    for (const stage of sortedSubStages(task.sub_stages)) {
      const end = stageEffectiveEndDate(stage)
      if (stage.is_done && dateInQuarter(end, year, quarter)) {
        done.push({
          taskId: task.id,
          taskName: task.name,
          showcase: meta.showcase,
          area: meta.area,
          kind: 'stage',
          label: stage.name,
          date: end!,
        })
      }

      if (!stage.is_done && isStagePlanned(stage)) {
        const planned = stagePlannedDates(stage)
        if (rangeOverlapsQuarter(planned.start_date, planned.end_date, year, quarter)) {
          plan.push({
            taskId: task.id,
            taskName: task.name,
            showcase: meta.showcase,
            area: meta.area,
            kind: 'stage',
            label: stage.name,
            startDate: planned.start_date,
            endDate: planned.end_date,
          })
        }
      }
    }

    if (
      task.status !== 'done' &&
      rangeOverlapsQuarter(task.indicative_start, task.indicative_end, year, quarter)
    ) {
      plan.push({
        taskId: task.id,
        taskName: task.name,
        showcase: meta.showcase,
        area: meta.area,
        kind: 'task',
        label: 'Индикативный срок задачи',
        startDate: task.indicative_start,
        endDate: task.indicative_end,
      })
    }

    if (task.status !== 'done' && desiredQuarterMatches(task.desired_quarter, year, quarter)) {
      plan.push({
        taskId: task.id,
        taskName: task.name,
        showcase: meta.showcase,
        area: meta.area,
        kind: 'task',
        label: 'Желаемый срок',
        startDate: task.desired_quarter,
        endDate: task.desired_quarter,
      })
    }
  }

  for (const milestone of project.milestones ?? []) {
    if (dateInQuarter(milestone.date, year, quarter)) {
      plan.push({
        taskId: 0,
        taskName: milestone.name,
        showcase: null,
        area: null,
        kind: 'milestone',
        label: 'Веха',
        startDate: milestone.date,
        endDate: milestone.date,
      })
    }
  }

  for (const event of auditEvents) {
    if (event.event_type !== 'dates') continue
    if (!auditEventInQuarter(event.created_at, year, quarter)) continue
    const task = tasksById.get(event.task_id)
    if (!task) continue
    const meta = taskMeta(task, project.categories)
    const stageParsed = parseStageAuditField(event.field)
    if (stageParsed) {
      pushUniqueShift(shifts, {
        taskId: task.id,
        taskName: task.name,
        showcase: meta.showcase,
        kind: 'stage',
        label: `${stageParsed.stageName} (${stageParsed.dateField === 'start_date' ? 'начало' : 'окончание'})`,
        oldValue: event.old_value,
        newValue: event.new_value,
        days: shiftDays(event.old_value, event.new_value),
        at: event.created_at,
        user: event.user_name,
      })
      continue
    }
    const field = event.field ?? ''
    if (field === 'indicative_start' || field === 'indicative_end') {
      pushUniqueShift(shifts, {
        taskId: task.id,
        taskName: task.name,
        showcase: meta.showcase,
        kind: 'indicative',
        label: taskFieldLabel(field),
        oldValue: event.old_value,
        newValue: event.new_value,
        days: shiftDays(event.old_value, event.new_value),
        at: event.created_at,
        user: event.user_name,
      })
      continue
    }
    if (field === 'start_date' || field === 'end_date') {
      pushUniqueShift(shifts, {
        taskId: task.id,
        taskName: task.name,
        showcase: meta.showcase,
        kind: 'task',
        label: taskFieldLabel(field),
        oldValue: event.old_value,
        newValue: event.new_value,
        days: shiftDays(event.old_value, event.new_value),
        at: event.created_at,
        user: event.user_name,
      })
    }
  }

  for (const task of project.tasks) {
    const meta = taskMeta(task, project.categories)
    for (const s of input.savedStageShifts[task.id] ?? []) {
      if (!rangeOverlapsQuarter(s.curStart, s.curEnd, year, quarter)) continue
      pushUniqueShift(shifts, {
        taskId: task.id,
        taskName: task.name,
        showcase: meta.showcase,
        kind: 'stage',
        label: s.stageName,
        oldValue: `${s.origStart} – ${s.origEnd}`,
        newValue: `${s.curStart} – ${s.curEnd}`,
        days: shiftDays(s.origEnd, s.curEnd),
        at: null,
        user: null,
        comment: s.shiftComment,
      })
    }
    for (const s of input.savedTaskShifts[task.id] ?? []) {
      if (!rangeOverlapsQuarter(s.curStart, s.curEnd, year, quarter)) continue
      pushUniqueShift(shifts, {
        taskId: task.id,
        taskName: task.name,
        showcase: meta.showcase,
        kind: 'task',
        label: 'Сроки задачи',
        oldValue: `${s.origStart} – ${s.origEnd}`,
        newValue: `${s.curStart} – ${s.curEnd}`,
        days: shiftDays(s.origEnd, s.curEnd),
        at: null,
        user: null,
        comment: s.shiftComment,
      })
    }
  }

  const sortByName = <T extends { taskName: string; label: string }>(a: T, b: T) =>
    a.taskName.localeCompare(b.taskName, 'ru') || a.label.localeCompare(b.label, 'ru')

  done.sort((a, b) => a.date.localeCompare(b.date) || sortByName(a, b))
  plan.sort(sortByName)
  shifts.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '') || sortByName(a, b))

  return { year, quarter, done, plan, shifts }
}

export function formatQuarterLabel(year: number, quarter: Quarter): string {
  const roman = ['I', 'II', 'III', 'IV'][quarter - 1]
  return `${roman} кв. ${year}`
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (start && end && start !== end) return `${start} – ${end}`
  return start ?? end ?? '—'
}

export function briefTaskLabel(showcase: string | null, taskName: string): string {
  const s = showcase?.trim()
  if (s && s.toLowerCase() !== taskName.trim().toLowerCase()) return s
  return taskName
}

export function briefDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = parseDate(iso)
  if (!d) return iso
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}`
}

export function briefDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  if (!end || start === end) return briefDate(start ?? end)
  if (!start) return briefDate(end)
  const a = briefDate(start)
  const b = briefDate(end)
  return a === b ? a : `${a}–${b}`
}

export interface QuarterReportBriefLine {
  taskId: number
  line: string
}

/** Сжатые строки для одностраничного отчёта. */
export function compactQuarterReport(report: QuarterReport): {
  done: QuarterReportBriefLine[]
  plan: QuarterReportBriefLine[]
  shifts: QuarterReportBriefLine[]
} {
  const tasksWithStagePlan = new Set(
    report.plan.filter((p) => p.kind === 'stage').map((p) => p.taskId)
  )
  const tasksWithStageDone = new Set(
    report.done.filter((d) => d.kind === 'stage').map((d) => d.taskId)
  )

  const plan = report.plan.filter((p) => {
    if (p.kind === 'stage' || p.kind === 'milestone') return true
    if (p.label === 'Индикативный срок задачи' && tasksWithStagePlan.has(p.taskId)) return false
    return true
  })

  const done = report.done.filter((d) => {
    if (d.kind === 'stage') return true
    return !tasksWithStageDone.has(d.taskId)
  })

  const formatShiftDelta = (days: number | null): string => {
    if (days == null) return ''
    if (days > 0) return `+${days}д`
    if (days < 0) return `−${-days}д`
    return '0д'
  }

  const trimComment = (text: string | undefined, max = 36): string => {
    const t = text?.trim()
    if (!t) return ''
    return t.length <= max ? t : `${t.slice(0, max - 1)}…`
  }

  return {
    done: done.map((item) => ({
      taskId: item.taskId,
      line:
        item.kind === 'stage'
          ? `${briefTaskLabel(item.showcase, item.taskName)}: ${item.label} ✓ ${briefDate(item.date)}`
          : `${briefTaskLabel(item.showcase, item.taskName)} ✓ ${briefDate(item.date)}`,
    })),
    plan: plan.map((item) => {
      if (item.kind === 'milestone') {
        return {
          taskId: 0,
          line: `◇ ${item.taskName} ${briefDate(item.startDate)}`,
        }
      }
      if (item.label === 'Желаемый срок') {
        return {
          taskId: item.taskId,
          line: `${briefTaskLabel(item.showcase, item.taskName)}: желаемый ${briefDateRange(item.startDate, item.endDate)}`,
        }
      }
      if (item.kind === 'task') {
        return {
          taskId: item.taskId,
          line: `${briefTaskLabel(item.showcase, item.taskName)}: ${briefDateRange(item.startDate, item.endDate)}`,
        }
      }
      return {
        taskId: item.taskId,
        line: `${briefTaskLabel(item.showcase, item.taskName)}: ${item.label} ${briefDateRange(item.startDate, item.endDate)}`,
      }
    }),
    shifts: report.shifts.map((item) => {
      const delta = formatShiftDelta(item.days)
      const who = item.comment ? trimComment(item.comment) : item.user ? trimComment(item.user, 20) : ''
      const tail = who ? ` — ${who}` : ''
      const subject =
        item.kind === 'stage'
          ? `${briefTaskLabel(item.showcase, item.taskName)}: ${item.label}`
          : briefTaskLabel(item.showcase, item.taskName)
      return {
        taskId: item.taskId,
        line: delta ? `${subject} ${delta}${tail}` : `${subject}${tail}`,
      }
    }),
  }
}
