import { useEffect } from 'react'
import { usePendingChangesStore } from '../stores/pendingChangesStore'

export function useUnsavedChangesWarning() {
  const taskCount = usePendingChangesStore((s) => Object.keys(s.taskChanges).length)
  const milestoneCount = usePendingChangesStore((s) => Object.keys(s.milestones).length)
  const pendingCount = taskCount + milestoneCount

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingCount > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [pendingCount])
}
