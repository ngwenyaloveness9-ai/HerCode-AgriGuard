import { useEffect, useState } from 'react';
import { useRepositories } from '@/services/repositoryProvider';
import type { Alert } from '@/types';

export function useAlerts(farmId: string | null) {
  const { repositories, ready } = useRepositories();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmId || !ready) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = repositories.alerts.subscribeToAlerts(
      farmId,
      (next) => {
        setAlerts(next);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [farmId, repositories, ready]);

  const active = alerts?.filter((a) => !a.resolvedAt) ?? null;
  return { alerts, active, loading, error };
}
