export const EFFORT_K_AN_KEY = 'effort_k_an'
export const EFFORT_K_DEV_KEY = 'effort_k_dev'
export const EFFORT_K_MA_KEY = 'effort_k_ma'
export const EFFORT_K_DM_KEY = 'effort_k_dm'

export const DEFAULT_K_AN = 1
export const DEFAULT_K_DEV = 0.5
export const DEFAULT_K_MA = 0.2
export const DEFAULT_K_DM = 1

export function parseAttributeCount(value: string | null | undefined): number | null {
  if (value == null || !String(value).trim()) return null
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.')
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function parseCoefficient(value: string | null | undefined, fallback: number): number {
  if (value == null || !String(value).trim()) return fallback
  const n = Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** [(n/2)·k_an + (n/2)·k_dev] × [1 + k_ma + k_dm·(1 + k_ma)] when showcase dev required */
export function effortMultiplier(
  kMa: number,
  kDm: number,
  showcaseDevelopmentRequired: boolean
): number {
  if (!showcaseDevelopmentRequired) return 1 + kMa
  return 1 + kMa + kDm * (1 + kMa)
}

export function calculatePlannedEffort(
  attributeCount: number,
  kAn: number,
  kDev: number,
  kMa: number,
  kDm: number,
  showcaseDevelopmentRequired: boolean
): number {
  const half = attributeCount / 2
  const base = half * kAn + half * kDev
  return base * effortMultiplier(kMa, kDm, showcaseDevelopmentRequired)
}

export function effortBreakdown(
  attributeCount: number,
  kAn: number,
  kDev: number,
  kMa: number,
  kDm: number,
  showcaseDevelopmentRequired: boolean
): {
  analytics: number
  development: number
  base: number
  multiplier: number
  total: number
} {
  const half = attributeCount / 2
  const analytics = half * kAn
  const development = half * kDev
  const base = analytics + development
  const multiplier = effortMultiplier(kMa, kDm, showcaseDevelopmentRequired)
  const total = base * multiplier
  return { analytics, development, base, multiplier, total }
}

export function formatPlannedEffort(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function plannedEffortFromAttributes(
  attributeCountRaw: string | null | undefined,
  kAnRaw: string | null | undefined,
  kDevRaw: string | null | undefined,
  kMaRaw: string | null | undefined,
  kDmRaw: string | null | undefined,
  showcaseDevelopmentRequired: boolean
): number | null {
  const count = parseAttributeCount(attributeCountRaw)
  if (count == null) return null
  return calculatePlannedEffort(
    count,
    parseCoefficient(kAnRaw, DEFAULT_K_AN),
    parseCoefficient(kDevRaw, DEFAULT_K_DEV),
    parseCoefficient(kMaRaw, DEFAULT_K_MA),
    parseCoefficient(kDmRaw, DEFAULT_K_DM),
    showcaseDevelopmentRequired
  )
}
