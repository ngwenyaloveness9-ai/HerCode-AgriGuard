import axios, { AxiosError, type AxiosInstance } from 'axios';
import { API_BASE_URL } from '@/constants/config';

/**
 * REST client for the Node.js backend. The auth token is injected at request
 * time by an accessor the auth layer registers, so no token is stored here.
 */

let tokenAccessor: (() => Promise<string | null>) | null = null;

export function registerTokenAccessor(accessor: () => Promise<string | null>): void {
  tokenAccessor = accessor;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiConfigured = Boolean(API_BASE_URL);

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  if (tokenAccessor) {
    const token = await tokenAccessor();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; code?: string }>) => {
    if (error.response) {
      throw new ApiError(
        error.response.data?.message ?? `Request failed with status ${error.response.status}`,
        error.response.status,
        error.response.data?.code,
      );
    }
    if (error.request) {
      throw new ApiError('No response from the backend. Check your connection and try again.');
    }
    throw new ApiError(error.message);
  },
);

/** Route map, mirroring the backend contract. */
export const ROUTES = {
  auth: '/api/auth',
  farms: '/api/farms',
  fields: '/api/fields',
  zones: '/api/zones',
  crops: '/api/crops',
  cropProfiles: '/api/crop-profiles',
  sensors: '/api/sensors',
  telemetry: '/api/telemetry',
  devices: '/api/devices',
  irrigation: '/api/irrigation',
  shade: '/api/shade',
  reservoir: '/api/reservoir',
  solar: '/api/solar',
  alerts: '/api/alerts',
  analytics: '/api/analytics',
  systemHealth: '/api/system-health',
  automation: '/api/automation',
  users: '/api/users',
} as const;
