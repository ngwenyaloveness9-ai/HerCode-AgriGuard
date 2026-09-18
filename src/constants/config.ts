/** Runtime configuration. Every value is environment-driven — nothing is baked in. */

export const DATA_SOURCE = (import.meta.env.VITE_DATA_SOURCE ?? 'firebase') as 'firebase' | 'api';

/**
 * A reading older than this is labelled STALE DATA and is never presented as LIVE.
 * Configurable so different farms can set their own reporting cadence.
 */
export const STALE_DATA_SECONDS = Number(import.meta.env.VITE_STALE_DATA_SECONDS ?? 120);

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';
