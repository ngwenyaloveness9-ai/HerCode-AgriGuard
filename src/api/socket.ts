import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/constants/config';

/**
 * Live telemetry transport. Events are typed so subscribers cannot listen for a
 * channel the backend does not publish.
 */

export interface ServerEvents {
  'telemetry:update': (payload: unknown) => void;
  'zone:update': (payload: unknown) => void;
  'device:status': (payload: unknown) => void;
  'irrigation:start': (payload: unknown) => void;
  'irrigation:stop': (payload: unknown) => void;
  'shade:deployed': (payload: unknown) => void;
  'shade:retracted': (payload: unknown) => void;
  'reservoir:update': (payload: unknown) => void;
  'solar:update': (payload: unknown) => void;
  'alert:new': (payload: unknown) => void;
  'alert:resolved': (payload: unknown) => void;
  'system:health': (payload: unknown) => void;
}

export type ServerEventName = keyof ServerEvents;

export const socketConfigured = Boolean(SOCKET_URL);

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (!socketConfigured) return null;
  socket ??= io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  return socket;
}

export function subscribe<E extends ServerEventName>(event: E, handler: ServerEvents[E]): () => void {
  const active = getSocket();
  if (!active) return () => {};
  active.on(event as string, handler as (...args: unknown[]) => void);
  return () => {
    active.off(event as string, handler as (...args: unknown[]) => void);
  };
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
