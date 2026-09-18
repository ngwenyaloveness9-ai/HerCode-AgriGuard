import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DATA_SOURCE } from '@/constants/config';
import { apiConfigured } from '@/api/client';
import { firebaseConfigured } from '@/firebase/config';
import type { RepositoryBundle } from '@/services/repositories';
import {
  FirebaseAlertRepository,
  FirebaseAutomationRepository,
  FirebaseCropProfileRepository,
  FirebaseDeviceRepository,
  FirebaseEnergyRepository,
  FirebaseFarmRepository,
  FirebaseIrrigationRepository,
  FirebaseUserRepository,
  FirebaseZoneRepository,
} from '@/services/firebase/entities';
import { FirebaseTelemetryRepository } from '@/services/firebase/telemetry';
import {
  ApiAlertRepository,
  ApiAutomationRepository,
  ApiCropProfileRepository,
  ApiDeviceRepository,
  ApiEnergyRepository,
  ApiFarmRepository,
  ApiIrrigationRepository,
  ApiTelemetryRepository,
  ApiUserRepository,
  ApiZoneRepository,
} from '@/services/api/repositories';

/**
 * Chooses the data path once, at the root. Screens never learn which one won.
 */

function buildFirebaseBundle(): RepositoryBundle {
  return {
    farms: new FirebaseFarmRepository(),
    zones: new FirebaseZoneRepository(),
    cropProfiles: new FirebaseCropProfileRepository(),
    telemetry: new FirebaseTelemetryRepository(),
    devices: new FirebaseDeviceRepository(),
    irrigation: new FirebaseIrrigationRepository(),
    energy: new FirebaseEnergyRepository(),
    alerts: new FirebaseAlertRepository(),
    automation: new FirebaseAutomationRepository(),
    users: new FirebaseUserRepository(),
  };
}

function buildApiBundle(): RepositoryBundle {
  return {
    farms: new ApiFarmRepository(),
    zones: new ApiZoneRepository(),
    cropProfiles: new ApiCropProfileRepository(),
    telemetry: new ApiTelemetryRepository(),
    devices: new ApiDeviceRepository(),
    irrigation: new ApiIrrigationRepository(),
    energy: new ApiEnergyRepository(),
    alerts: new ApiAlertRepository(),
    automation: new ApiAutomationRepository(),
    users: new ApiUserRepository(),
  };
}

export interface RepositoryContextValue {
  repositories: RepositoryBundle;
  source: 'firebase' | 'api';
  /** False when the selected source has no credentials configured. */
  ready: boolean;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const value = useMemo<RepositoryContextValue>(() => {
    const source = DATA_SOURCE === 'api' ? 'api' : 'firebase';
    return {
      repositories: source === 'api' ? buildApiBundle() : buildFirebaseBundle(),
      source,
      ready: source === 'api' ? apiConfigured : firebaseConfigured,
    };
  }, []);

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function useRepositories(): RepositoryContextValue {
  const context = useContext(RepositoryContext);
  if (!context) throw new Error('useRepositories must be used inside RepositoryProvider');
  return context;
}
