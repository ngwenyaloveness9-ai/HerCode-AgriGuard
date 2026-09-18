import type { SensorType } from '@/types';

export const SENSOR_LABEL: Record<SensorType, string> = {
  SOIL_MOISTURE: 'Soil moisture',
  SOIL_TEMPERATURE: 'Soil temperature',
  AMBIENT_TEMPERATURE: 'Ambient temperature',
  HUMIDITY: 'Humidity',
  LIGHT: 'Light',
  RESERVOIR_LEVEL: 'Reservoir level',
  FLOW: 'Water flow',
  SOLAR_VOLTAGE: 'Solar voltage',
  SOLAR_CURRENT: 'Solar current',
  BATTERY_VOLTAGE: 'Battery voltage',
  BATTERY_PERCENT: 'Battery charge',
};

export const CROP_LABEL = {
  MACADAMIA: 'Macadamia',
  CITRUS: 'Citrus',
} as const;
