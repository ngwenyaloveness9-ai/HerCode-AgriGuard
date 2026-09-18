import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRepositories } from '@/services/repositoryProvider';
import { useLatestReadings } from '@/hooks/useTelemetry';
import { evaluateZone, type ZoneEvaluation } from '@/utils/zoneStatus';
import type { CropProfile, Zone } from '@/types';

export interface EvaluatedZone {
  zone: Zone;
  profile: CropProfile | null;
  evaluation: ZoneEvaluation;
}

export function useZones(farmId: string | null, fieldId?: string) {
  const { repositories, ready } = useRepositories();
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmId || !ready) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = repositories.zones.subscribeToZones(
      farmId,
      (next) => {
        setZones(fieldId ? next.filter((z) => z.fieldId === fieldId) : next);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [farmId, fieldId, repositories, ready]);

  return { zones, loading, error };
}

export function useCropProfiles(farmId: string | null) {
  const { repositories, ready } = useRepositories();
  return useQuery({
    queryKey: ['cropProfiles', farmId],
    queryFn: () => repositories.cropProfiles.listProfiles(farmId!),
    enabled: ready && Boolean(farmId),
  });
}

/**
 * Zones with their status recomputed from live readings and the assigned crop
 * profile, so a status badge always reflects the reading beside it.
 */
export function useEvaluatedZones(farmId: string | null, fieldId?: string) {
  const { zones, loading: zonesLoading, error: zonesError } = useZones(farmId, fieldId);
  const { readings, loading: readingsLoading } = useLatestReadings(farmId);
  const profilesQuery = useCropProfiles(farmId);

  const evaluated = useMemo<EvaluatedZone[] | null>(() => {
    if (!zones) return null;
    const profiles = profilesQuery.data ?? [];
    return zones.map((zone) => {
      const profile = profiles.find((p) => p.id === zone.cropProfileId) ?? null;
      // Farm-wide readings are keyed by sensor type; narrow to this zone.
      const zoneReadings = Object.fromEntries(
        Object.entries(readings ?? {}).filter(([, reading]) => reading?.zoneId === zone.id),
      );
      return {
        zone,
        profile,
        evaluation: evaluateZone(zone, zoneReadings, profile, null),
      };
    });
  }, [zones, readings, profilesQuery.data]);

  return {
    zones: evaluated,
    loading: zonesLoading || readingsLoading || profilesQuery.isLoading,
    error: zonesError ?? (profilesQuery.error as Error | null) ?? null,
  };
}
