import type { AuditEventType, Moscow, ReleaseStatus, TaskStatus, ViewMode } from '../types'

export const ru = {
  appTitle: 'Дорожная карта проекта',
  loading: 'Загрузка дорожной карты…',
  noProject: 'Проект не найден.',
  backToProjects: 'К проектам',

  welcome: {
    title: 'Добро пожаловать',
    subtitle: 'Введите имя для отображения в истории изменений.',
    namePlaceholder: 'Ваше имя',
    continue: 'Продолжить',
  },

  startPage: {
    eyebrow: 'Дорожная карта',
    heading: 'Ваши проекты',
    empty: 'Проектов пока нет — создайте ниже.',
    newProject: '+ Новый проект',
    cancel: 'Отмена',
    projectName: 'Название проекта',
    projectNamePlaceholder: 'например, Витрины Q3',
    description: 'Описание',
    descriptionPlaceholder: 'Краткое описание (необязательно)',
    creating: 'Создание…',
    create: 'Создать проект',
    loadingProject: 'Загрузка проекта…',
    selected: 'Выбранный проект',
    selectHint: 'Выберите проект или создайте новый.',
    open: 'Открыть проект',
    stats: {
      tasks: 'Задачи',
      categories: 'Категории',
      inProgress: 'В работе',
    },
  },

  toolbar: {
    allProjects: 'Все проекты',
    projects: '← Проекты',
    indicative: 'Индикативные сроки',
    shiftComments: 'Комментарии к сдвигам',
    groupingTitle: 'Группировка на диаграмме Ганта, таймлайне и в таблице',
    colorCoding: 'Цветовая кодировка',
    categoryGroups: 'Группы по категориям',
    categories: 'Категории',
    audit: 'Журнал аудита',
  },

  views: {
    gantt: 'Гант',
    timeline: 'Таймлайн',
    kanban: 'Канбан',
    table: 'Таблица',
    backlog: 'Бэклог',
    release_board: 'Релизы',
  } satisfies Record<ViewMode, string>,

  gantt: {
    showPriority: 'Показывать приоритет',
    filterTitle: 'Фильтр по приоритету',
    filterAll: 'Все',
    priorityNone: 'Без приоритета',
    priorityLabel: (p: number) => `P${p}`,
    shownCount: (shown: number, total: number) => `Показано ${shown} из ${total}`,
    emptyFilter: 'Нет задач для выбранных приоритетов',
  },

  status: {
    todo: 'Не начато',
    in_progress: 'В работе',
    blocked: 'На паузе',
    done: 'Готово',
  } satisfies Record<TaskStatus, string>,

  audit: {
    title: 'Журнал аудита проекта',
    empty: 'Записей аудита нет',
    close: 'Закрыть',
    task: 'Задача',
    filters: {
      all: 'Все',
      dates: 'Даты',
      cost: 'Стоимость',
      effort: 'Трудозатраты',
      comment: 'Комментарии',
      status: 'Статус',
      other: 'Прочее',
    } satisfies Record<AuditEventType | 'all', string>,
    eventType: {
      dates: 'даты',
      cost: 'стоимость',
      effort: 'трудозатраты',
      comment: 'комментарий',
      status: 'статус',
      other: 'прочее',
    } satisfies Record<AuditEventType, string>,
  },

  categories: {
    title: 'Управление категориями',
    deleteConfirm: (name: string) => `Удалить категорию «${name}»?`,
    delete: 'Удалить',
    newPlaceholder: 'Название категории',
    add: 'Добавить категорию',
    close: 'Закрыть',
  },

  components: {
    title: 'Общие источники',
    subtitle:
      'Один источник данных может использоваться в нескольких витринах. Сроки и этапы хранятся один раз и синхронизируются между всеми использованиями.',
    empty: 'Общих источников пока нет.',
    sharedBadge: 'Общий',
    usageCount: (n: number) => `${n} ${n === 1 ? 'использование' : n < 5 ? 'использования' : 'использований'}`,
    toolbar: 'Источники',
    close: 'Закрыть',
    bannerTitle: 'Общий источник',
    bannerHint: (count: number) =>
      `Сроки и этапы синхронизируются с ${count} ${count === 1 ? 'использованием' : count < 5 ? 'использованиями' : 'использованиями'} проекта.`,
    otherUsages: 'Другие использования',
    unlink: 'Отвязать (сохранить копию)',
    unlinking: 'Отвязка…',
  },

  releases: {
    title: 'Управление релизами',
    subtitle: 'Группируйте задачи по релизам и отслеживайте целевые даты запуска.',
    deleteConfirm: (name: string) => `Удалить релиз «${name}»? Задачи останутся без релиза.`,
    delete: 'Удалить',
    newPlaceholder: 'Название релиза',
    targetDate: 'Целевая дата',
    description: 'Описание',
    add: 'Добавить релиз',
    close: 'Закрыть',
    toolbar: 'Релизы',
    unassigned: 'Без релиза',
    status: {
      planned: 'Запланирован',
      in_progress: 'В работе',
      released: 'Выпущен',
    } satisfies Record<ReleaseStatus, string>,
  },

  goals: {
    title: 'Цели проекта',
    subtitle: 'Связывайте задачи с целями компании или продукта.',
    deleteConfirm: (name: string) => `Удалить цель «${name}»?`,
    delete: 'Удалить',
    newPlaceholder: 'Название цели',
    description: 'Описание',
    add: 'Добавить цель',
    close: 'Закрыть',
    toolbar: 'Цели',
    none: 'Без цели',
  },

  backlog: {
    methodTitle: 'Метод приоритизации',
    methods: {
      rice: 'RICE',
      value_effort: 'Ценность / Усилие',
      moscow: 'MoSCoW',
    },
    score: 'Оценка',
    reach: 'Охват',
    impact: 'Влияние',
    confidence: 'Уверенность %',
    effort: 'Усилие',
    value: 'Ценность',
    moscow: 'MoSCoW',
    release: 'Релиз',
    goal: 'Цель',
    category: 'Категория',
    status: 'Статус',
    hint: 'Отсортируйте бэклог по выбранному методу. Изменения сохраняются локально.',
    moscowLabels: {
      must: 'Must',
      should: 'Should',
      could: 'Could',
      wont: "Won't",
    } satisfies Record<Moscow, string>,
  },

  releaseBoard: {
    hint: 'Перетащите задачи между релизами для назначения.',
  },

  table: {
    addTask: '+ Добавить задачу',
    hint: 'Изменения сохраняются локально — нажмите «Сохранить» внизу.',
    usage: 'Использование',
    sharedSource: 'Общий',
    indicativeHint: 'Индикативное окончание',
    predecessors: 'Предшественники',
    predecessorsPlaceholder: 'Названия задач через запятую',
    delete: 'Удалить',
    deleteTask: 'Удалить задачу',
    deletingTask: 'Удаление…',
    plannedCost: 'План. стоимость',
    actualCost: 'Факт. стоимость',
    plannedEffort: 'План. трудозатраты',
    actualEffort: 'Факт. трудозатраты',
    groupActual: 'Факт',
    groupIndicative: 'Индикатив',
    newTask: 'Новая задача',
  },

  kanban: {
    unassigned: 'Не назначен',
  },

  errors: {
    versionConflict: 'Конфликт версий',
  },

  drawer: {
    unsaved: 'не сохранено',
    complete: (pct: number) => `${pct}% выполнено`,
    markAllDone: 'Отметить все выполненными',
    addStage: '+ Добавить этап',
    stageName: 'Название этапа',
    stageNamePlaceholder: 'например, Разработка',
    stageDueDate: 'Срок',
    stageIndicative: 'Индикативный',
    addingStage: 'Добавление…',
    noStages: 'Нет этапов',
    comments: 'Комментарии',
    commentPlaceholder: 'Добавить комментарий…',
    post: 'Отправить',
    history: 'История',
    noHistory: 'Записей истории нет',
    plannedCost: 'Плановая стоимость',
    actualCost: 'Фактическая стоимость',
    plannedEffort: 'Плановые трудозатраты (ч)',
    actualEffort: 'Фактические трудозатраты (ч)',
    deleteTask: 'Удалить задачу',
    deleteTaskConfirm: (name: string) => `Удалить задачу «${name}»? Это действие нельзя отменить.`,
    deletingTask: 'Удаление…',
  },

  timeline: {
    milestones: 'Вехи',
    indicative: 'Индикатив',
  },

  saveBar: {
    discard: 'Отменить',
    save: 'Сохранить изменения',
    saveWithoutShift: 'Сохранить изменения без сдвига',
    saving: 'Сохранение…',
    failed: 'Не удалось сохранить изменения',
  },

  shift: {
    was: (from: string, to: string) => `Было ${from} – ${to}`,
    saved: '(сохранено)',
    unsaved: '(не сохранено)',
    clickToComment: 'Нажмите, чтобы добавить комментарий',
    comment: (text: string) => `Комментарий: ${text}`,
    dateShift: (label: string) => `${label} — сдвиг дат`,
    milestoneShift: (name: string) => `${name} — сдвиг вехи`,
    edgeStart: 'нач.',
    edgeEnd: 'кон.',
    close: 'Закрыть',
    whyRescheduled: 'Почему перенесли срок?',
    noComment: 'Комментарий к сдвигу не указан.',
    savedTag: 'Сохранено',
    commentOn: (label: string) => `Комментарий: ${label}`,
    addCommentTask: (label: string) => `Комментарий к сдвигу дат — ${label}`,
    addCommentMilestone: (label: string) => `Комментарий к сдвигу вехи — ${label}`,
  },

  groups: {
    allTasks: 'Все задачи',
    uncategorized: 'Без категории',
    noDates: 'Нет дат',
    actual: 'Факт',
    indicative: 'Индикатив',
  },

  locale: 'ru-RU',
} as const

export const VIEW_OPTIONS = (Object.keys(ru.views) as ViewMode[]).map((id) => ({
  id,
  label: ru.views[id],
}))

export const STATUS_OPTIONS = (Object.keys(ru.status) as TaskStatus[]).map((id) => ({
  id,
  label: ru.status[id],
}))

export const AUDIT_FILTER_OPTIONS = (
  Object.keys(ru.audit.filters) as (AuditEventType | 'all')[]
).map((id) => ({
  id,
  label: ru.audit.filters[id],
}))

export const HISTORY_FILTER_OPTIONS = AUDIT_FILTER_OPTIONS

export function pluralUnsavedChanges(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} несохранённое изменение`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${n} несохранённых изменения`
  }
  return `${n} несохранённых изменений`
}

export function formatLocaleDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(ru.locale)
}

export function formatLocaleMonthYear(date: Date): string {
  return date.toLocaleString(ru.locale, { month: 'short', year: 'numeric' })
}
