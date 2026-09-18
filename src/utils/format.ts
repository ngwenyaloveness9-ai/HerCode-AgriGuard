import { formatDistanceToNowStrict } from 'date-fns';

/** The single placeholder used everywhere a reading is absent. */
export const NO_VALUE = '--';

export function formatReading(value: number | null | undefined, unit?: string, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
}

export function formatRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp) return 'never';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function formatTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return NO_VALUE;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return NO_VALUE;
  return date.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return NO_VALUE;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDelta(value: number | null, unit?: string): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}${unit ? ` ${unit}` : ''}`;
}
