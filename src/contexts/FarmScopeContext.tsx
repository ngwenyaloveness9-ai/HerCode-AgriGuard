import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRepositories } from '@/services/repositoryProvider';
import { useAuth } from '@/contexts/AuthContext';
import type { Farm, Field } from '@/types';

/**
 * The farm and field currently in view. Selection is never assumed: with no
 * farms configured the scope stays null and screens show their empty state.
 */

interface FarmScopeValue {
  farms: Farm[];
  fields: Field[];
  farmId: string | null;
  fieldId: string | null;
  farm: Farm | null;
  setFarmId(id: string | null): void;
  setFieldId(id: string | null): void;
  loading: boolean;
  error: Error | null;
}

const FarmScopeContext = createContext<FarmScopeValue | null>(null);

const STORAGE_KEY = 'agriguard.selectedFarm';

export function FarmScopeProvider({ children }: { children: ReactNode }) {
  const { repositories, ready } = useRepositories();
  const { firebaseUser } = useAuth();
  const [farmId, setFarmIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [fieldId, setFieldId] = useState<string | null>(null);

  const farmsQuery = useQuery({
    queryKey: ['farms', firebaseUser?.uid],
    queryFn: () => repositories.farms.listFarms(firebaseUser!.uid),
    enabled: ready && Boolean(firebaseUser),
  });

  const fieldsQuery = useQuery({
    queryKey: ['fields', farmId],
    queryFn: () => repositories.farms.listFields(farmId!),
    enabled: ready && Boolean(farmId),
  });

  const farms = farmsQuery.data ?? [];

  useEffect(() => {
    if (farms.length === 0) return;
    if (!farmId || !farms.some((f) => f.id === farmId)) {
      setFarmIdState(farms[0]!.id);
    }
  }, [farms, farmId]);

  const setFarmId = (id: string | null) => {
    setFarmIdState(id);
    setFieldId(null);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo<FarmScopeValue>(
    () => ({
      farms,
      fields: fieldsQuery.data ?? [],
      farmId,
      fieldId,
      farm: farms.find((f) => f.id === farmId) ?? null,
      setFarmId,
      setFieldId,
      loading: farmsQuery.isLoading,
      error: (farmsQuery.error as Error | null) ?? null,
    }),
    [farms, fieldsQuery.data, farmId, fieldId, farmsQuery.isLoading, farmsQuery.error],
  );

  return <FarmScopeContext.Provider value={value}>{children}</FarmScopeContext.Provider>;
}

export function useFarmScope(): FarmScopeValue {
  const context = useContext(FarmScopeContext);
  if (!context) throw new Error('useFarmScope must be used inside FarmScopeProvider');
  return context;
}
