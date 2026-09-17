/**
 * AgriGuard 3D — domain model.
 *
 * Every value that appears in the UI is described here. There are no default
 * readings and no default agronomic thresholds in this file: thresholds live on
 * CropProfile records supplied by the backend, and readings arrive from telemetry.
 */

export type ISODateTime = string;

/* ------------------------------------------------------------------ */
/* Organisation                                                        */
/* ------------------------------------------------------------------ */

export interface Farm {
  id: string;
  name: string;
  organisation?: string;
  region?: string;
  timezone?: string;
  coordinates?: { latitude: number; longitude: number };
  createdAt: ISODateTime;
}

export interface Field {
  id: string;
  farmId: string;
  name: string;
  areaHectares?: number;
  createdAt: ISODateTime;
}

export type CropType = 'MACADAMIA' | 'CITRUS';

export type ZoneStatus =
  | 'NORMAL'
  | 'DRY'
  | 'CRITICAL_DRY'
  | 'HEAT_STRESS'
  | 'EXCESS_MOISTURE'
  | 'SENSOR_ERROR'
  | 'OFFLINE'
  | 'STALE_DATA'
  | 'UNKNOWN';

export interface Zone {
  id: string;
  farmId: string;
  fieldId?: string;
  name: string;
  cropType: CropType;
  cultivar?: string;
  growthStage?: string;
  soilType?: string;
  cropProfileId?: string;
  rootZoneDepthCm?: number;
  irrigationMethod?: string;
  status: ZoneStatus;
  sensors: string[];
  actuators: string[];
  lastUpdated?: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* Agronomy                                                            */
/* ------------------------------------------------------------------ */

export type MoistureMeasurementType = 'VOLUMETRIC_PERCENT' | 'RAW_ADC' | 'TENSION_KPA' | 'PERCENT_OF_CAPACITY';

/**
 * Agronomist-defined thresholds. Every field is optional because a profile may be
 * partially configured — the UI must degrade to "not configured" rather than
 * substituting a value of its own.
 */
export interface CropProfile {
  id: string;
  farmId: string;
  name: string;
  cropType: CropType;
  cultivar?: string;
  growthStage?: string;
  soilType?: string;
  rootZoneDepthCm?: number;
  irrigationMethod?: string;
  moistureMeasurementType?: MoistureMeasurementType;

  moistureMin?: number;
  moistureTargetLow?: number;
  moistureTargetHigh?: number;
  moistureCriticalLow?: number;
  moistureExcessHigh?: number;

  temperatureMin?: number;
  temperatureTargetLow?: number;
  temperatureTargetHigh?: number;
  temperatureCriticalHigh?: number;

  humidityTargetLow?: number;
  humidityTargetHigh?: number;

  lightThreshold?: number;

  irrigationStartThreshold?: number;
  irrigationStopThreshold?: number;

  shadeActivationTemperature?: number;
  shadeDeactivationTemperature?: number;

  updatedAt?: ISODateTime;
  updatedBy?: string;
}

/* ------------------------------------------------------------------ */
/* Telemetry                                                           */
/* ------------------------------------------------------------------ */

export type SensorType =
  | 'SOIL_MOISTURE'
  | 'SOIL_TEMPERATURE'
  | 'AMBIENT_TEMPERATURE'
  | 'HUMIDITY'
  | 'LIGHT'
  | 'RESERVOIR_LEVEL'
  | 'FLOW'
  | 'SOLAR_VOLTAGE'
  | 'SOLAR_CURRENT'
  | 'BATTERY_VOLTAGE'
  | 'BATTERY_PERCENT';

export type ReadingQuality = 'GOOD' | 'SUSPECT' | 'BAD';
export type ReadingSource = 'ESP32' | 'BACKEND' | 'MANUAL';

export interface Sensor {
  id: string;
  farmId: string;
  zoneId?: string;
  deviceId: string;
  sensorType: SensorType;
  label?: string;
  unit: string;
  calibratedAt?: ISODateTime;
  status: DeviceStatus;
}

export interface SensorReading {
  id: string;
  farmId: string;
  zoneId?: string;
  sensorId: string;
  sensorType: SensorType;
  value: number;
  unit: string;
  timestamp: ISODateTime;
  quality: ReadingQuality;
  source: ReadingSource;
}

/** Latest reading per sensor type for a zone. Absent keys mean "never received". */
export type LatestReadings = Partial<Record<SensorType, SensorReading>>;

export interface TimeSeriesPoint {
  timestamp: ISODateTime;
  value: number;
}

export interface TimeSeries {
  sensorType: SensorType;
  zoneId?: string;
  unit: string;
  points: TimeSeriesPoint[];
}

export type TimeRange = '24h' | '7d' | '30d' | '12m' | 'custom';
export type ComparisonPeriod = 'TODAY' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface ComparisonResult {
  metric: string;
  unit: string;
  currentValue: number | null;
  previousValue: number | null;
  absoluteDifference: number | null;
  percentageDifference: number | null;
  trend: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
  /** False when the backend did not hold enough history to compare. */
  sufficientData: boolean;
}

/* ------------------------------------------------------------------ */
/* Devices and actuators                                               */
/* ------------------------------------------------------------------ */

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN';

export type DeviceType =
  | 'ESP32'
  | 'SOIL_MOISTURE_SENSOR'
  | 'TEMPERATURE_SENSOR'
  | 'HUMIDITY_SENSOR'
  | 'LIGHT_SENSOR'
  | 'RESERVOIR_SENSOR'
  | 'FLOW_METER'
  | 'PUMP'
  | 'VALVE'
  | 'SHADE_SERVO'
  | 'SOLAR_MONITOR';

export interface Device {
  id: string;
  farmId: string;
  zoneId?: string;
  name: string;
  deviceType: DeviceType;
  status: DeviceStatus;
  lastSeen?: ISODateTime;
  firmwareVersion?: string;
  batteryPercent?: number;
  signalStrengthDbm?: number;
}

export interface DeviceHealth {
  deviceId: string;
  status: DeviceStatus;
  lastSeen?: ISODateTime;
  message?: string;
}

export interface SystemHealth {
  components: DeviceHealth[];
  backend: DeviceStatus;
  database: DeviceStatus;
  network: DeviceStatus;
  reportedAt?: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* Actuator command lifecycle                                          */
/* ------------------------------------------------------------------ */

export type CommandState =
  | 'IDLE'
  | 'SENDING'
  | 'ACCEPTED'
  | 'WAITING_FOR_DEVICE'
  | 'CONFIRMED'
  | 'FAILED';

export type ActuatorAction =
  | 'START_IRRIGATION'
  | 'STOP_IRRIGATION'
  | 'OPEN_VALVE'
  | 'CLOSE_VALVE'
  | 'DEPLOY_SHADE'
  | 'RETRACT_SHADE';

export interface ActuatorCommand {
  id: string;
  farmId: string;
  zoneId?: string;
  deviceId: string;
  action: ActuatorAction;
  state: CommandState;
  issuedBy: string;
  issuedAt: ISODateTime;
  confirmedAt?: ISODateTime;
  failureReason?: string;
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export type IrrigationTrigger = 'AUTOMATION' | 'MANUAL' | 'SCHEDULE';

export interface IrrigationEvent {
  id: string;
  farmId: string;
  zoneId: string;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  durationSeconds?: number;
  volumeLitres?: number;
  trigger: IrrigationTrigger;
  startMoisture?: number;
  endMoisture?: number;
  initiatedBy?: string;
}

export interface ShadeEvent {
  id: string;
  farmId: string;
  zoneId: string;
  action: 'DEPLOYED' | 'RETRACTED';
  timestamp: ISODateTime;
  triggerTemperature?: number;
  trigger: IrrigationTrigger;
}

export interface ReservoirReading {
  id: string;
  farmId: string;
  levelPercent?: number;
  distanceCm?: number;
  estimatedLitres?: number;
  timestamp: ISODateTime;
  quality: ReadingQuality;
}

export interface ReservoirConfig {
  farmId: string;
  /** Litres are only ever shown when capacity and geometry are configured. */
  capacityLitres?: number;
  heightCm?: number;
  sensorOffsetCm?: number;
  lowLevelPercent?: number;
  criticalLevelPercent?: number;
}

export interface FlowReading {
  id: string;
  farmId: string;
  zoneId?: string;
  litresPerMinute: number;
  timestamp: ISODateTime;
}

export interface SolarReading {
  id: string;
  farmId: string;
  voltage?: number;
  current?: number;
  powerWatts?: number;
  timestamp: ISODateTime;
}

export interface BatteryReading {
  id: string;
  farmId: string;
  voltage?: number;
  percent?: number;
  charging?: boolean;
  timestamp: ISODateTime;
}

export interface WeatherReading {
  id: string;
  farmId: string;
  temperature?: number;
  humidity?: number;
  conditions?: string;
  timestamp: ISODateTime;
  source: string;
}

/* ------------------------------------------------------------------ */
/* Alerts and automation                                               */
/* ------------------------------------------------------------------ */

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AlertCategory =
  | 'MOISTURE'
  | 'HEAT'
  | 'WATER'
  | 'IRRIGATION'
  | 'SENSOR'
  | 'DEVICE'
  | 'ENERGY'
  | 'CONNECTIVITY';

export interface Alert {
  id: string;
  farmId: string;
  zoneId?: string;
  cropType?: CropType;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  trigger: string;
  measuredValue?: number;
  configuredThreshold?: number;
  unit?: string;
  systemResponse?: string;
  timestamp: ISODateTime;
  resolvedAt?: ISODateTime;
  resolvedBy?: string;
}

export interface AutomationRule {
  id: string;
  farmId: string;
  zoneId?: string;
  name: string;
  enabled: boolean;
  conditionSensor: SensorType;
  conditionOperator: 'BELOW' | 'ABOVE';
  conditionThreshold: number;
  action: ActuatorAction;
  recoveryThreshold?: number;
  maxRuntimeMinutes?: number;
  minReservoirPercent?: number;
  cooldownMinutes?: number;
  sensorFailureBehaviour: 'HALT' | 'IGNORE' | 'FALLBACK_SCHEDULE';
  updatedAt?: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export type UserRole = 'ADMINISTRATOR' | 'FARM_MANAGER' | 'AGRONOMIST' | 'OPERATOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organisation?: string;
  role: UserRole;
  farmIds: string[];
  createdAt?: ISODateTime;
}

export interface AuditLog {
  id: string;
  farmId: string;
  userId: string;
  action: string;
  target?: string;
  timestamp: ISODateTime;
  metadata?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Connection state                                                    */
/* ------------------------------------------------------------------ */

export type LiveState = 'LIVE' | 'STALE' | 'OFFLINE' | 'CONNECTING';
