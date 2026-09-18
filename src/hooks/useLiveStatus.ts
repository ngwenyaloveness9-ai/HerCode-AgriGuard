import { useEffect, useMemo, useState } from 'react';
import { getSocket, socketConfigured } from '@/api/socket';
import { DATA_SOURCE, STALE_DATA_SECONDS } from '@/constants/config';
import { isStale, secondsSince } from '@/utils/zoneStatus';
import type { LatestReadings, LiveState } from '@/types';

/**
 * Global connection indicator.
 *
 * LIVE requires two things: a transport that is actually connected, and a
 * reading newer than the stale interval. Neither is assumed.
 */
export function useLiveStatus(readings: LatestReadings | null, loading: boolean): {
  state: LiveState;
  lastReadingAt: string | null;
  secondsSinceLastReading: number | null;
} {
  const [transportConnected, setTransportConnected] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((t) => t + 1), 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (DATA_SOURCE === 'api' && socketConfigured) {
      const socket = getSocket();
      if (!socket) return;
      setTransportConnected(socket.connected);
      const onConnect = () => setTransportConnected(true);
      const onDisconnect = () => setTransportConnected(false);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
      };
    }
    // Firestore listeners report liveness through data arrival rather than a
    // connection event, so transport state is left unresolved here.
    setTransportConnected(null);
    return undefined;
  }, []);

  const lastReadingAt = useMemo(() => {
    if (!readings) return null;
    let newest: string | null = null;
    for (const reading of Object.values(readings)) {
      if (!reading) continue;
      if (!newest || reading.timestamp > newest) newest = reading.timestamp;
    }
    return newest;
  }, [readings]);

  const state = useMemo<LiveState>(() => {
    void tick;
    if (loading && !lastReadingAt) return 'CONNECTING';
    if (transportConnected === false) return 'OFFLINE';
    if (!lastReadingAt) return 'OFFLINE';
    return isStale(lastReadingAt) ? 'STALE' : 'LIVE';
  }, [loading, lastReadingAt, transportConnected, tick]);

  return {
    state,
    lastReadingAt,
    secondsSinceLastReading: secondsSince(lastReadingAt ?? undefined),
  };
}

export { STALE_DATA_SECONDS };
