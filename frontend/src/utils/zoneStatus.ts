import type {
  CropProfile,
  LatestReadings,
  SensorReading,
  Zone,
  ZoneStatus,
} from '@/types';
import { STALE_DATA_SECONDS } from '@/constants/config';

/**
 * Status evaluation.
 *
 * Rules:
 *  - A status is only derived from a reading that exists and from a threshold
 *    that has been configured. A missing threshold never falls back to a
 *    built-in number.
 *  - Staleness outranks any agronomic reading: an old number is not a live one.
 *  - The returned object carries the reasoning so the UI can show the measured
 *    value next to the configured threshold that produced the status.
 */

export interface ZoneEvaluation {
  status: ZoneStatus;
  /** Human-readable explanation, or null when nothing could be evaluated. */
  reason: string | null;
  measuredValue: number | null;
  configuredThreshold: number | null;
  unit: string | null;
  /** True when the profile lacks the thresholds needed to judge this zone. */
  profileIncomplete: boolean;
  lastReadingAt: string | null;
}

export function isStale(timestamp: string | undefined, now: number = Date.now()): boolean {
  if (!timestamp) return false;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return false;
  return now - t > STALE_DATA_SECONDS * 1000;
}

export function secondsSince(timestamp: string | undefined, now: number = Date.now()): number | null {
  if (!timestamp) return null;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}

function newestReading(readings: LatestReadings): SensorReading | null {
  let newest: SensorReading | null = null;
  for (const reading of Object.values(readings)) {
    if (!reading) continue;
    if (!newest || new Date(reading.timestamp) > new Date(newest.timestamp)) {
      newest = reading;
    }
  }
  return newest;
}

const UNKNOWN: ZoneEvaluation = {
  status: 'UNKNOWN',
  reason: null,
  measuredValue: null,
  configuredThreshold: null,
  unit: null,
  profileIncomplete: false,
  lastReadingAt: null,
};

export function evaluateZone(
  zone: Zone,
  readings: LatestReadings,
  profile: CropProfile | null | undefined,
  deviceOnline: boolean | null,
  now: number = Date.now(),
): ZoneEvaluation {
  const newest = newestReading(readings);

  if (deviceOnline === false) {
    return { ...UNKNOWN, status: 'OFFLINE', reason: 'Controller is not reporting', lastReadingAt: newest?.timestamp ?? null };
  }

  if (!newest) {
    return { ...UNKNOWN, status: 'UNKNOWN', reason: 'No telemetry received yet' };
  }

  if (isStale(newest.timestamp, now)) {
    return {
      ...UNKNOWN,
      status: 'STALE_DATA',
      reason: 'Last reading is older than the configured stale-data interval',
      lastReadingAt: newest.timestamp,
    };
  }

  const moisture = readings.SOIL_MOISTURE;
  const soilTemp = readings.SOIL_TEMPERATURE;
  const ambient = readings.AMBIENT_TEMPERATURE;

  if (moisture?.quality === 'BAD' || soilTemp?.quality === 'BAD') {
    return {
      ...UNKNOWN,
      status: 'SENSOR_ERROR',
      reason: 'Sensor reported a bad-quality reading',
      lastReadingAt: newest.timestamp,
    };
  }

  if (!profile) {
    return {
      ...UNKNOWN,
      status: 'UNKNOWN',
      reason: `No crop profile assigned to ${zone.name}`,
      profileIncomplete: true,
      lastReadingAt: newest.timestamp,
    };
  }

  const base = { profileIncomplete: false, lastReadingAt: newest.timestamp };

  // 1. Critical dryness.
  if (moisture && isNumber(profile.moistureCriticalLow) && moisture.value <= profile.moistureCriticalLow) {
    return {
      ...base,
      status: 'CRITICAL_DRY',
      reason: 'Root-zone moisture is at or below the configured critical threshold',
      measuredValue: moisture.value,
      configuredThreshold: profile.moistureCriticalLow,
      unit: moisture.unit,
    };
  }

  // 2. Heat stress.
  const heatReading = soilTemp ?? ambient;
  if (heatReading && isNumber(profile.temperatureCriticalHigh) && heatReading.value >= profile.temperatureCriticalHigh) {
    return {
      ...base,
      status: 'HEAT_STRESS',
      reason: 'Temperature is at or above the configured critical threshold',
      measuredValue: heatReading.value,
      configuredThreshold: profile.temperatureCriticalHigh,
      unit: heatReading.unit,
    };
  }

  // 3. Waterlogging risk.
  if (moisture && isNumber(profile.moistureExcessHigh) && moisture.value >= profile.moistureExcessHigh) {
    return {
      ...base,
      status: 'EXCESS_MOISTURE',
      reason: 'Root-zone moisture is at or above the configured excess threshold',
      measuredValue: moisture.value,
      configuredThreshold: profile.moistureExcessHigh,
      unit: moisture.unit,
    };
  }

  // 4. Dry but not critical.
  if (moisture && isNumber(profile.moistureTargetLow) && moisture.value < profile.moistureTargetLow) {
    return {
      ...base,
      status: 'DRY',
      reason: 'Root-zone moisture is below the configured target range',
      measuredValue: moisture.value,
      configuredThreshold: profile.moistureTargetLow,
      unit: moisture.unit,
    };
  }

  // 5. Within range — but only claim that if a range was actually configured.
  if (moisture && isNumber(profile.moistureTargetLow) && isNumber(profile.moistureTargetHigh)) {
    return {
      ...base,
      status: 'NORMAL',
      reason: 'Root-zone moisture is inside the configured target range',
      measuredValue: moisture.value,
      configuredThreshold: profile.moistureTargetLow,
      unit: moisture.unit,
    };
  }

  return {
    ...UNKNOWN,
    status: 'UNKNOWN',
    reason: 'Crop profile does not define the thresholds needed to evaluate this zone',
    profileIncomplete: true,
    lastReadingAt: newest.timestamp,
  };
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export const ZONE_STATUS_LABEL: Record<ZoneStatus, string> = {
  NORMAL: 'Normal',
  DRY: 'Dry',
  CRITICAL_DRY: 'Critical dry',
  HEAT_STRESS: 'Heat stress',
  EXCESS_MOISTURE: 'Excess moisture',
  SENSOR_ERROR: 'Sensor error',
  OFFLINE: 'Offline',
  STALE_DATA: 'Stale data',
  UNKNOWN: 'Not evaluated',
};
