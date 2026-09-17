import type {
  ActuatorAction,
  ActuatorCommand,
  Alert,
  AutomationRule,
  BatteryReading,
  ComparisonPeriod,
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
  SensorType,
  ShadeEvent,
  SolarReading,
  SystemHealth,
  TimeSeries,
  User,
  Zone,
} from '@/types';

/**
 * Data access contracts.
 *
 * UI components depend only on these interfaces. Two implementations exist:
 * FirebaseXRepository (ESP32 -> Firebase) and ApiXRepository (ESP32 -> Node.js
 * -> Firebase). Swapping VITE_DATA_SOURCE changes the wiring, not the screens.
 *
 * Implementations must never invent a value. If a record does not exist they
 * return null or an empty array; if the transport fails they throw.
 */

export type Unsubscribe = () => void;

export interface FarmRepository {
  listFarms(userId: string): Promise<Farm[]>;
  getFarm(farmId: string): Promise<Farm | null>;
  createFarm(farm: Omit<Farm, 'id' | 'createdAt'>): Promise<Farm>;
  listFields(farmId: string): Promise<Field[]>;
  createField(field: Omit<Field, 'id' | 'createdAt'>): Promise<Field>;
}

export interface ZoneRepository {
  listZones(farmId: string, fieldId?: string): Promise<Zone[]>;
  getZone(zoneId: string): Promise<Zone | null>;
  createZone(zone: Omit<Zone, 'id' | 'status'>): Promise<Zone>;
  updateZone(zoneId: string, patch: Partial<Zone>): Promise<Zone>;
  subscribeToZones(farmId: string, onChange: (zones: Zone[]) => void, onError: (e: Error) => void): Unsubscribe;
}

export interface CropProfileRepository {
  listProfiles(farmId: string): Promise<CropProfile[]>;
  getProfile(profileId: string): Promise<CropProfile | null>;
  saveProfile(profile: CropProfile): Promise<CropProfile>;
}

export interface TelemetryRepository {
  /** Latest reading per sensor type. Missing keys mean nothing has arrived. */
  getLatestReadings(farmId: string, zoneId?: string): Promise<LatestReadings>;
  subscribeToLatestReadings(
    farmId: string,
    zoneId: string | undefined,
    onChange: (readings: LatestReadings) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
  /** Stored history only. Returns an empty point list when none was recorded. */
  getHistory(params: {
    farmId: string;
    zoneId?: string;
    sensorType: SensorType;
    from: string;
    to: string;
    bucket?: 'raw' | 'hour' | 'day' | 'month';
  }): Promise<TimeSeries>;
  /**
   * Period comparison computed from stored history. Implementations set
   * sufficientData=false rather than filling gaps.
   */
  getComparison(params: {
    farmId: string;
    zoneId?: string;
    metric: SensorType | 'WATER_VOLUME' | 'IRRIGATION_DURATION' | 'IRRIGATION_COUNT' | 'SOLAR_ENERGY';
    period: ComparisonPeriod;
  }): Promise<ComparisonResult>;
}

export interface DeviceRepository {
  listDevices(farmId: string): Promise<Device[]>;
  getDevice(deviceId: string): Promise<Device | null>;
  getSystemHealth(farmId: string): Promise<SystemHealth | null>;
  subscribeToSystemHealth(
    farmId: string,
    onChange: (health: SystemHealth) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
}

export interface IrrigationRepository {
  listEvents(farmId: string, params?: { zoneId?: string; from?: string; to?: string; limit?: number }): Promise<IrrigationEvent[]>;
  getActiveSession(farmId: string, zoneId?: string): Promise<IrrigationEvent | null>;
  listShadeEvents(farmId: string, zoneId?: string): Promise<ShadeEvent[]>;
  getReservoirConfig(farmId: string): Promise<ReservoirConfig | null>;
  getLatestReservoirReading(farmId: string): Promise<ReservoirReading | null>;
  getLatestFlowReading(farmId: string, zoneId?: string): Promise<FlowReading | null>;
  /**
   * Issues a command and returns its initial record. The caller must then watch
   * the command until the device confirms — a resolved promise means "sent",
   * never "done".
   */
  sendCommand(params: { farmId: string; zoneId?: string; deviceId: string; action: ActuatorAction }): Promise<ActuatorCommand>;
  subscribeToCommand(
    commandId: string,
    onChange: (command: ActuatorCommand) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
}

export interface EnergyRepository {
  getLatestSolarReading(farmId: string): Promise<SolarReading | null>;
  getLatestBatteryReading(farmId: string): Promise<BatteryReading | null>;
}

export interface AlertRepository {
  listAlerts(farmId: string, params?: { resolved?: boolean; limit?: number }): Promise<Alert[]>;
  subscribeToAlerts(farmId: string, onChange: (alerts: Alert[]) => void, onError: (e: Error) => void): Unsubscribe;
  resolveAlert(alertId: string, userId: string): Promise<Alert>;
}

export interface AutomationRepository {
  listRules(farmId: string): Promise<AutomationRule[]>;
  saveRule(rule: AutomationRule): Promise<AutomationRule>;
  deleteRule(ruleId: string): Promise<void>;
}

export interface UserRepository {
  getProfile(userId: string): Promise<User | null>;
  createProfile(user: Omit<User, 'createdAt'>): Promise<User>;
  listUsers(farmId: string): Promise<User[]>;
}

export interface RepositoryBundle {
  farms: FarmRepository;
  zones: ZoneRepository;
  cropProfiles: CropProfileRepository;
  telemetry: TelemetryRepository;
  devices: DeviceRepository;
  irrigation: IrrigationRepository;
  energy: EnergyRepository;
  alerts: AlertRepository;
  automation: AutomationRepository;
  users: UserRepository;
}
