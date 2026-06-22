import type { StageTemplate } from '../types'
import { stageNameTaken } from './stageTemplates'

export const STAGE_BUNDLE_PREFIX = '__bundle:'

export interface StageBundle {
  id: string
  label: string
  /** Match predefined templates whose full_label starts with this prefix. */
  groupPrefix: string
}

export const PREDEFINED_STAGE_BUNDLES: StageBundle[] = [
  {
    id: `${STAGE_BUNDLE_PREFIX}detailed_layer`,
    label: 'Загрузка детального слоя',
    groupPrefix: 'Детальный слой /',
  },
  {
    id: `${STAGE_BUNDLE_PREFIX}showcase`,
    label: 'Разработка Витрины',
    groupPrefix: 'Витрина данных /',
  },
]

export function isStageBundleValue(value: string): boolean {
  return value.startsWith(STAGE_BUNDLE_PREFIX)
}

export function findStageBundle(value: string): StageBundle | undefined {
  return PREDEFINED_STAGE_BUNDLES.find((b) => b.id === value)
}

export function bundleStageNames(bundle: StageBundle, predefined: StageTemplate[]): string[] {
  return predefined
    .filter((t) => t.full_label.startsWith(bundle.groupPrefix))
    .map((t) => t.full_label)
}

export function bundleStagesToAdd(
  bundle: StageBundle,
  predefined: StageTemplate[],
  existingNames: Set<string>
): string[] {
  return bundleStageNames(bundle, predefined).filter((name) => !stageNameTaken(existingNames, name))
}
