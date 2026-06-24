import { ru } from '../../locale/ru'

export type TaskDrawerTab = 'general' | 'stages' | 'contractor' | 'effort' | 'other'

export const DRAWER_TABS: { id: TaskDrawerTab; labelKey: keyof typeof ru.drawer.tabs }[] = [
  { id: 'general', labelKey: 'general' },
  { id: 'stages', labelKey: 'stages' },
  { id: 'contractor', labelKey: 'contractor' },
  { id: 'effort', labelKey: 'effort' },
  { id: 'other', labelKey: 'other' },
]
