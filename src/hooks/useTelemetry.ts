import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRepositories } from '@/services/repositoryProvider';
import type { LatestReadings, SensorType, TimeSeries } from '@/types';

/** Live latest-readings subscription for a farm or a single zone. */
export function useLatestReadings(farmId: string | null, zoneId?: string) {
  const { repositories, ready } = useRepositories();
  const [readings, setReadings] = useState<LatestReadings | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmId || !ready) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = repositories.telemetry.subscribeToLatestReadings(
      farmId,
      zoneId,
      (next) => {
        setReadings(next);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [farmId, zoneId, repositories, ready]);

  return { readings, loading, error };
}

export function useHistory(params: {
  farmId: string | null;
  zoneId?: string;
  sensorType: SensorType;
  from: string;
  to: string;
  bucket?: 'raw' | 'hour' | 'day' | 'month';
  enabled?: boolean;
}) {
  const { repositories, ready } = useRepositories();
  return useQuery<TimeSeries>({
    queryKey: ['history', params.farmId, params.zoneId, params.sensorType, params.from, params.to, params.bucket],
    queryFn: () =>
      repositories.telemetry.getHistory({
        farmId: params.farmId!,
        zoneId: params.zoneId,
        sensorType: params.sensorType,
        from: params.from,
        to: params.to,
        bucket: params.bucket,
      }),
    enabled: ready && Boolean(params.farmId) && params.enabled !== false,
  });
}

export function useComparison(params: {
  farmId: string | null;
  zoneId?: string;
  metric: Parameters<ReturnType<typeof useRepositories>['repositories']['telemetry']['getComparison']>[0]['metric'];
  period: Parameters<ReturnType<typeof useRepositories>['repositories']['telemetry']['getComparison']>[0]['period'];
}) {
  const { repositories, ready } = useRepositories();
  return useQuery({
    queryKey: ['comparison', params.farmId, params.zoneId, params.metric, params.period],
    queryFn: () =>
      repositories.telemetry.getComparison({
        farmId: params.farmId!,
        zoneId: params.zoneId,
        metric: params.metric,
        period: params.period,
      }),
    enabled: ready && Boolean(params.farmId),
  });
}
