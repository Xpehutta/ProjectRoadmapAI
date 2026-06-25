import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useJiraStatus() {
  return useQuery({
    queryKey: ['jira', 'status'],
    queryFn: () => api.getJiraStatus(),
    staleTime: 60_000,
  })
}
