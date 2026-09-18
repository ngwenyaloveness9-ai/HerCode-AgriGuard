import { useEffect, useState } from 'react';
import { useRepositories } from '@/services/repositoryProvider';
import type { SystemHealth } from '@/types';

export function useSystemHealth(farmId: string | null) {
  const { repositories, ready } = useRepositories();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmId || !ready) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = repositories.devices.subscribeToSystemHealth(
      farmId,
      (next) => {
        setHealth(next);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [farmId, repositories, ready]);

  return { health, loading, error };
}
