import { apiClient, ROUTES } from '@/api/client';
import { subscribe } from '@/api/socket';
import type {
  AlertRepository,
  AutomationRepository,
  CropProfileRepository,
  DeviceRepository,
  EnergyRepository,
  FarmRepository,
  IrrigationRepository,
  TelemetryRepository,
  Unsubscribe,
  UserRepository,
  ZoneRepository,
} from '@/services/repositories';
import type {
  ActuatorCommand,
  Alert,
  AutomationRule,
  BatteryReading,
  ComparisonResult,
  CropProfile,
  Device,
  Farm,
  Field,
  FlowReading,
  IrrigationEvent,
  LatestReadings,
  ReservoirConfig,
  ReservoirReading,
  ShadeEvent,
  SolarReading,
  SystemHealth,
  TimeSeries,
  User,
  Zone,
} from '@/types';

/**
 * Backend-backed repositories (ESP32 -> Node.js -> Firebase).
 *
 * Live updates arrive over Socket.IO; the initial value always comes from REST
 * so a screen is never rendered from an assumption about what the socket will
 * eventually send.
 */

const get = async <T>(url: string, params?: Record<string, unknown>): Promise<T> =>
  (await apiClient.get<T>(url, { params })).data;

export class ApiFarmRepository implements FarmRepository {
  listFarms = (userId: string) => get<Farm[]>(ROUTES.farms, { userId });
  getFarm = async (farmId: string) => (await get<Farm | null>(`${ROUTES.farms}/${farmId}`)) ?? null;
  createFarm = async (farm: Omit<Farm, 'id' | 'createdAt'>) => (await apiClient.post<Farm>(ROUTES.farms, farm)).data;
  listFields = (farmId: string) => get<Field[]>(ROUTES.fields, { farmId });
  createField = async (field: Omit<Field, 'id' | 'createdAt'>) => (await apiClient.post<Field>(ROUTES.fields, field)).data;
}

export class ApiZoneRepository implements ZoneRepository {
  listZones = (farmId: string, fieldId?: string) => get<Zone[]>(ROUTES.zones, { farmId, fieldId });
  getZone = async (zoneId: string) => (await get<Zone | null>(`${ROUTES.zones}/${zoneId}`)) ?? null;
  createZone = async (zone: Omit<Zone, 'id' | 'status'>) => (await apiClient.post<Zone>(ROUTES.zones, zone)).data;
  updateZone = async (zoneId: string, patch: Partial<Zone>) =>
    (await apiClient.patch<Zone>(`${ROUTES.zones}/${zoneId}`, patch)).data;

  subscribeToZones(farmId: string, onChange: (zones: Zone[]) => void, onError: (e: Error) => void): Unsubscribe {
    this.listZones(farmId).then(onChange).catch(onError);
    return subscribe('zone:update', () => {
      this.listZones(farmId).then(onChange).catch(onError);
    });
  }
}

export class ApiCropProfileRepository implements CropProfileRepository {
  listProfiles = (farmId: string) => get<CropProfile[]>(ROUTES.cropProfiles, { farmId });
  getProfile = async (id: string) => (await get<CropProfile | null>(`${ROUTES.cropProfiles}/${id}`)) ?? null;
  saveProfile = async (profile: CropProfile) =>
    (await apiClient.put<CropProfile>(`${ROUTES.cropProfiles}/${profile.id}`, profile)).data;
}

export class ApiTelemetryRepository implements TelemetryRepository {
  getLatestReadings = (farmId: string, zoneId?: string) =>
    get<LatestReadings>(`${ROUTES.telemetry}/latest`, { farmId, zoneId });

  subscribeToLatestReadings(
    farmId: string,
    zoneId: string | undefined,
    onChange: (readings: LatestReadings) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    this.getLatestReadings(farmId, zoneId).then(onChange).catch(onError);
    return subscribe('telemetry:update', () => {
      this.getLatestReadings(farmId, zoneId).then(onChange).catch(onError);
    });
  }

  getHistory = (params: Parameters<TelemetryRepository['getHistory']>[0]) =>
    get<TimeSeries>(`${ROUTES.telemetry}/history`, params as Record<string, unknown>);

  getComparison = (params: Parameters<TelemetryRepository['getComparison']>[0]) =>
    get<ComparisonResult>(`${ROUTES.analytics}/comparison`, params as Record<string, unknown>);
}

export class ApiDeviceRepository implements DeviceRepository {
  listDevices = (farmId: string) => get<Device[]>(ROUTES.devices, { farmId });
  getDevice = async (deviceId: string) => (await get<Device | null>(`${ROUTES.devices}/${deviceId}`)) ?? null;
  getSystemHealth = async (farmId: string) => (await get<SystemHealth | null>(ROUTES.systemHealth, { farmId })) ?? null;

  subscribeToSystemHealth(farmId: string, onChange: (h: SystemHealth) => void, onError: (e: Error) => void): Unsubscribe {
    this.getSystemHealth(farmId).then((h) => h && onChange(h)).catch(onError);
    return subscribe('system:health', () => {
      this.getSystemHealth(farmId).then((h) => h && onChange(h)).catch(onError);
    });
  }
}

export class ApiIrrigationRepository implements IrrigationRepository {
  listEvents = (farmId: string, params?: { zoneId?: string; from?: string; to?: string; limit?: number }) =>
    get<IrrigationEvent[]>(`${ROUTES.irrigation}/events`, { farmId, ...params });

  getActiveSession = async (farmId: string, zoneId?: string) =>
    (await get<IrrigationEvent | null>(`${ROUTES.irrigation}/active`, { farmId, zoneId })) ?? null;

  listShadeEvents = (farmId: string, zoneId?: string) => get<ShadeEvent[]>(`${ROUTES.shade}/events`, { farmId, zoneId });

  getReservoirConfig = async (farmId: string) =>
    (await get<ReservoirConfig | null>(`${ROUTES.reservoir}/config`, { farmId })) ?? null;

  getLatestReservoirReading = async (farmId: string) =>
    (await get<ReservoirReading | null>(`${ROUTES.reservoir}/latest`, { farmId })) ?? null;

  getLatestFlowReading = async (farmId: string, zoneId?: string) =>
    (await get<FlowReading | null>(`${ROUTES.irrigation}/flow/latest`, { farmId, zoneId })) ?? null;

  sendCommand = async (params: {
    farmId: string;
    zoneId?: string;
    deviceId: string;
    action: ActuatorCommand['action'];
  }) => (await apiClient.post<ActuatorCommand>(`${ROUTES.irrigation}/commands`, params)).data;

  subscribeToCommand(commandId: string, onChange: (c: ActuatorCommand) => void, onError: (e: Error) => void): Unsubscribe {
    const poll = () =>
      get<ActuatorCommand>(`${ROUTES.irrigation}/commands/${commandId}`).then(onChange).catch(onError);
    poll();
    // Device confirmation arrives on the irrigation channel; re-read the command
    // record rather than inferring state from the event payload.
    const off = subscribe('device:status', poll);
    const interval = window.setInterval(poll, 3000);
    return () => {
      off();
      window.clearInterval(interval);
    };
  }
}

export class ApiEnergyRepository implements EnergyRepository {
  getLatestSolarReading = async (farmId: string) =>
    (await get<SolarReading | null>(`${ROUTES.solar}/latest`, { farmId })) ?? null;
  getLatestBatteryReading = async (farmId: string) =>
    (await get<BatteryReading | null>(`${ROUTES.solar}/battery/latest`, { farmId })) ?? null;
}

export class ApiAlertRepository implements AlertRepository {
  listAlerts = (farmId: string, params?: { resolved?: boolean; limit?: number }) =>
    get<Alert[]>(ROUTES.alerts, { farmId, ...params });

  subscribeToAlerts(farmId: string, onChange: (alerts: Alert[]) => void, onError: (e: Error) => void): Unsubscribe {
    const reload = () => this.listAlerts(farmId).then(onChange).catch(onError);
    reload();
    const offNew = subscribe('alert:new', reload);
    const offResolved = subscribe('alert:resolved', reload);
    return () => {
      offNew();
      offResolved();
    };
  }

  resolveAlert = async (alertId: string, userId: string) =>
    (await apiClient.post<Alert>(`${ROUTES.alerts}/${alertId}/resolve`, { userId })).data;
}

export class ApiAutomationRepository implements AutomationRepository {
  listRules = (farmId: string) => get<AutomationRule[]>(ROUTES.automation, { farmId });
  saveRule = async (rule: AutomationRule) =>
    (await apiClient.put<AutomationRule>(`${ROUTES.automation}/${rule.id}`, rule)).data;
  deleteRule = async (ruleId: string) => {
    await apiClient.delete(`${ROUTES.automation}/${ruleId}`);
  };
}

export class ApiUserRepository implements UserRepository {
  getProfile = async (userId: string) => (await get<User | null>(`${ROUTES.users}/${userId}`)) ?? null;
  createProfile = async (user: Omit<User, 'createdAt'>) => (await apiClient.post<User>(ROUTES.users, user)).data;
  listUsers = (farmId: string) => get<User[]>(ROUTES.users, { farmId });
}
