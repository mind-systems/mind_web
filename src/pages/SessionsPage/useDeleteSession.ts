import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/core/api/client';
import { logger } from '@/core/observe';

export function useDeleteSession(selectedId?: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/sessions/runs/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['session-runs'] });
      if (id === selectedId) navigate('/sessions');
    },
    onError: (err) =>
      logger.error(
        `Failed to delete session: ${err instanceof Error ? err.message : String(err)}`,
      ),
  });
}
