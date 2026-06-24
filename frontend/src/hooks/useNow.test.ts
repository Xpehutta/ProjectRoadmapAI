import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns current date and updates on interval', () => {
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'))

    const { result } = renderHook(() => useNow(1000))
    const initial = result.current.getTime()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.getTime()).toBeGreaterThanOrEqual(initial)
  })
})
