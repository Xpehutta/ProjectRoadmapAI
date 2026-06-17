import type { StageTemplate } from '../types'

export const CUSTOM_STAGE_VALUE = '__custom__'

export function groupStageTemplates(templates: StageTemplate[]): Map<string, StageTemplate[]> {
  const groups = new Map<string, StageTemplate[]>()
  for (const template of templates) {
    const key = template.group || '—'
    const list = groups.get(key) ?? []
    list.push(template)
    groups.set(key, list)
  }
  return groups
}

export function stageNameTaken(existingNames: Set<string>, fullLabel: string): boolean {
  return existingNames.has(fullLabel.trim().toLowerCase())
}

export function existingStageNameSet(names: string[]): Set<string> {
  return new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))
}
