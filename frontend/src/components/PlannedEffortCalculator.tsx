import { useMemo, useState } from 'react'
import { ru } from '../locale/ru'
import {
  DEFAULT_K_AN,
  DEFAULT_K_DEV,
  DEFAULT_K_DM,
  DEFAULT_K_MA,
  effortBreakdown,
  formatPlannedEffort,
  parseAttributeCount,
  parseCoefficient,
  plannedEffortFromAttributes,
} from '../utils/effortCalculator'

interface Props {
  attributeCount: string | null
  plannedEffort: string | null
  showcaseDevelopmentRequired: boolean
  kAn: string
  kDev: string
  kMa: string
  kDm: string
  onKAnBlur: (value: string) => void
  onKDevBlur: (value: string) => void
  onKMaBlur: (value: string) => void
  onKDmBlur: (value: string) => void
  onApply: (effort: string) => void
}

export function PlannedEffortCalculator({
  attributeCount,
  plannedEffort,
  showcaseDevelopmentRequired,
  kAn,
  kDev,
  kMa,
  kDm,
  onKAnBlur,
  onKDevBlur,
  onKMaBlur,
  onKDmBlur,
  onApply,
}: Props) {
  const [kAnDraft, setKAnDraft] = useState(kAn)
  const [kDevDraft, setKDevDraft] = useState(kDev)
  const [kMaDraft, setKMaDraft] = useState(kMa)
  const [kDmDraft, setKDmDraft] = useState(kDm)

  const suggested = useMemo(
    () =>
      plannedEffortFromAttributes(
        attributeCount,
        kAnDraft,
        kDevDraft,
        kMaDraft,
        kDmDraft,
        showcaseDevelopmentRequired
      ),
    [attributeCount, kAnDraft, kDevDraft, kMaDraft, kDmDraft, showcaseDevelopmentRequired]
  )

  const suggestedText = suggested == null ? null : formatPlannedEffort(suggested)
  const count = parseAttributeCount(attributeCount)
  const breakdown =
    count != null && suggested != null
      ? effortBreakdown(
          count,
          parseCoefficient(kAnDraft, DEFAULT_K_AN),
          parseCoefficient(kDevDraft, DEFAULT_K_DEV),
          parseCoefficient(kMaDraft, DEFAULT_K_MA),
          parseCoefficient(kDmDraft, DEFAULT_K_DM),
          showcaseDevelopmentRequired
        )
      : null

  const formulaText = showcaseDevelopmentRequired
    ? ru.drawer.effortCalculatorFormulaWithShowcase
    : ru.drawer.effortCalculatorFormula

  return (
    <div className="effort-calculator">
      <h4>{ru.drawer.effortCalculatorTitle}</h4>
      <p className="muted effort-calculator-formula">{formulaText}</p>
      <div
        className={`effort-calculator-coeffs ${
          showcaseDevelopmentRequired
            ? 'effort-calculator-coeffs-four'
            : 'effort-calculator-coeffs-three'
        }`}
      >
        <label>
          {ru.drawer.effortKAn}
          <input
            type="number"
            min={0}
            step="0.1"
            value={kAnDraft}
            onChange={(e) => setKAnDraft(e.target.value)}
            onBlur={() => onKAnBlur(kAnDraft.trim() || String(DEFAULT_K_AN))}
          />
        </label>
        <label>
          {ru.drawer.effortKDev}
          <input
            type="number"
            min={0}
            step="0.1"
            value={kDevDraft}
            onChange={(e) => setKDevDraft(e.target.value)}
            onBlur={() => onKDevBlur(kDevDraft.trim() || String(DEFAULT_K_DEV))}
          />
        </label>
        <label>
          {ru.drawer.effortKMa}
          <input
            type="number"
            min={0}
            step="0.05"
            value={kMaDraft}
            onChange={(e) => setKMaDraft(e.target.value)}
            onBlur={() => onKMaBlur(kMaDraft.trim() || String(DEFAULT_K_MA))}
          />
        </label>
        {showcaseDevelopmentRequired ? (
          <label>
            {ru.drawer.effortKDm}
            <input
              type="number"
              min={0}
              step="0.1"
              value={kDmDraft}
              onChange={(e) => setKDmDraft(e.target.value)}
              onBlur={() => onKDmBlur(kDmDraft.trim() || String(DEFAULT_K_DM))}
            />
          </label>
        ) : null}
      </div>
      {suggestedText && breakdown ? (
        <div className="effort-calculator-result">
          <span className="effort-calculator-value">
            {ru.drawer.effortCalculatorSuggested(suggestedText)}
          </span>
          <span className="muted effort-calculator-breakdown">
            {showcaseDevelopmentRequired
              ? ru.drawer.effortCalculatorBreakdownWithShowcase(
                  formatPlannedEffort(breakdown.analytics),
                  formatPlannedEffort(breakdown.development),
                  formatPlannedEffort(breakdown.base),
                  kMaDraft.trim() || String(DEFAULT_K_MA),
                  kDmDraft.trim() || String(DEFAULT_K_DM),
                  formatPlannedEffort(breakdown.multiplier)
                )
              : ru.drawer.effortCalculatorBreakdown(
                  formatPlannedEffort(breakdown.analytics),
                  formatPlannedEffort(breakdown.development),
                  formatPlannedEffort(breakdown.base),
                  formatPlannedEffort(breakdown.multiplier)
                )}
          </span>
          <button
            type="button"
            className="btn-small"
            disabled={plannedEffort === suggestedText}
            onClick={() => onApply(suggestedText)}
          >
            {ru.drawer.effortCalculatorApply}
          </button>
        </div>
      ) : (
        <p className="muted effort-calculator-hint">{ru.drawer.effortCalculatorNeedAttributes}</p>
      )}
    </div>
  )
}
