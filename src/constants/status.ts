import type { AlertSeverity, DeviceStatus, LiveState, ZoneStatus } from '@/types';

/**
 * Status presentation. Colour is never the only carrier of meaning — each entry
 * pairs a tone with an icon name and a text label.
 */
export interface StatusPresentation {
  label: string;
  icon: string;
  className: string;
  dotClassName: string;
}

export const ZONE_STATUS_PRESENTATION: Record<ZoneStatus, StatusPresentation> = {
  NORMAL: { label: 'Normal', icon: 'CircleCheck', className: 'bg-leaf/10 text-forest border-leaf/30', dotClassName: 'bg-leaf' },
  DRY: { label: 'Dry', icon: 'Droplet', className: 'bg-solar/15 text-[#7a5a00] border-solar/40', dotClassName: 'bg-solar' },
  CRITICAL_DRY: { label: 'Critical dry', icon: 'TriangleAlert', className: 'bg-critical/10 text-critical border-critical/30', dotClassName: 'bg-critical' },
  HEAT_STRESS: { label: 'Heat stress', icon: 'Thermometer', className: 'bg-warn/12 text-warn border-warn/35', dotClassName: 'bg-warn' },
  EXCESS_MOISTURE: { label: 'Excess moisture', icon: 'Waves', className: 'bg-water/10 text-water border-water/30', dotClassName: 'bg-water' },
  SENSOR_ERROR: { label: 'Sensor error', icon: 'CircleX', className: 'bg-critical/10 text-critical border-critical/30', dotClassName: 'bg-critical' },
  OFFLINE: { label: 'Offline', icon: 'PlugZap', className: 'bg-ink/8 text-ink/70 border-ink/20', dotClassName: 'bg-ink/40' },
  STALE_DATA: { label: 'Stale data', icon: 'Clock', className: 'bg-warn/12 text-warn border-warn/35', dotClassName: 'bg-warn' },
  UNKNOWN: { label: 'Not evaluated', icon: 'CircleHelp', className: 'bg-ink/6 text-ink/60 border-ink/15', dotClassName: 'bg-ink/30' },
};

export const DEVICE_STATUS_PRESENTATION: Record<DeviceStatus, StatusPresentation> = {
  ONLINE: { label: 'Online', icon: 'CircleCheck', className: 'bg-leaf/10 text-forest border-leaf/30', dotClassName: 'bg-leaf' },
  OFFLINE: { label: 'Offline', icon: 'CircleX', className: 'bg-critical/10 text-critical border-critical/30', dotClassName: 'bg-critical' },
  DEGRADED: { label: 'Degraded', icon: 'TriangleAlert', className: 'bg-warn/12 text-warn border-warn/35', dotClassName: 'bg-warn' },
  UNKNOWN: { label: 'Unknown', icon: 'CircleHelp', className: 'bg-ink/6 text-ink/60 border-ink/15', dotClassName: 'bg-ink/30' },
};

export const LIVE_STATE_PRESENTATION: Record<LiveState, StatusPresentation> = {
  LIVE: { label: 'Live', icon: 'Radio', className: 'text-leaf', dotClassName: 'bg-leaf' },
  STALE: { label: 'Stale', icon: 'Clock', className: 'text-warn', dotClassName: 'bg-warn' },
  OFFLINE: { label: 'Offline', icon: 'WifiOff', className: 'text-critical', dotClassName: 'bg-critical' },
  CONNECTING: { label: 'Connecting', icon: 'Loader', className: 'text-ink/50', dotClassName: 'bg-ink/30' },
};

export const ALERT_SEVERITY_PRESENTATION: Record<AlertSeverity, StatusPresentation> = {
  INFO: { label: 'Info', icon: 'Info', className: 'bg-water/10 text-water border-water/30', dotClassName: 'bg-water' },
  WARNING: { label: 'Warning', icon: 'TriangleAlert', className: 'bg-warn/12 text-warn border-warn/35', dotClassName: 'bg-warn' },
  CRITICAL: { label: 'Critical', icon: 'OctagonAlert', className: 'bg-critical/10 text-critical border-critical/30', dotClassName: 'bg-critical' },
};
