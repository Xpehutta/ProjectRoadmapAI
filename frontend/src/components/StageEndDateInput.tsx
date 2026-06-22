import type { FocusEvent, MouseEvent } from 'react'
import { minStageEndDate } from '../utils/subStageDates'

interface BaseProps {
  startDate: string | null | undefined
  className?: string
}

interface ControlledProps extends BaseProps {
  value: string
  onChange: (value: string) => void
  defaultValue?: never
  inputKey?: never
  onBlur?: (value: string) => void
}

interface UncontrolledProps extends BaseProps {
  value?: never
  onChange?: never
  defaultValue?: string
  inputKey?: string
  onBlur?: (value: string) => void
}

type Props = ControlledProps | UncontrolledProps

function primeEmptyEndPicker(
  input: HTMLInputElement,
  min: string | undefined,
  onPrime?: (value: string) => void
) {
  if (!min || input.value) return
  input.value = min
  onPrime?.(min)
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
    } catch {
      // showPicker may throw if not triggered by user gesture in some browsers
    }
  }
}

export function StageEndDateInput(props: Props) {
  const { startDate, className, onBlur } = props
  const min = minStageEndDate(startDate)

  const shared = {
    type: 'date' as const,
    min,
    className,
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      if ('value' in props && props.value !== undefined) {
        if (!props.value && min) props.onChange(min)
        return
      }
      primeEmptyEndPicker(e.currentTarget, min)
    },
    onClick: (e: MouseEvent<HTMLInputElement>) => {
      if ('value' in props && props.value !== undefined) {
        if (!props.value && min) props.onChange(min)
        return
      }
      primeEmptyEndPicker(e.currentTarget, min)
    },
    onBlur: onBlur ? (e: FocusEvent<HTMLInputElement>) => onBlur(e.target.value) : undefined,
  }

  if ('value' in props && props.value !== undefined) {
    return (
      <input
        {...shared}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    )
  }

  return (
    <input
      key={props.inputKey}
      {...shared}
      defaultValue={props.defaultValue ?? ''}
    />
  )
}
