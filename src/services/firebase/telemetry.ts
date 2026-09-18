import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { COLLECTIONS, getDb } from '@/firebase/config';
import { toISO, toNumber } from '@/firebase/converters';
import type { TelemetryRepository, Unsubscribe } from '@/services/repositories';
import type {
  ComparisonResult,
  LatestReadings,
  SensorReading,
  SensorType,
  TimeSeries,
  TimeSeriesPoint,
} from '@/types';

function mapReading(data: Record<string, unknown>, id: string): SensorReading | null {
  const value = toNumber(data.value);
  const timestamp = toISO(data.timestamp);
  const sensorType = data.sensorType as SensorType | undefined;
  // A reading without a value, a time or a type is not a reading. Drop it
  // rather than displaying a placeholder number.
  if (value === undefined || !timestamp || !sensorType) return null;
  return {
    id,
    farmId: String(data.farmId ?? ''),
    zoneId: data.zoneId ? String(data.zoneId) : undefined,
    sensorId: String(data.sensorId ?? ''),
    sensorType,
    value,
    unit: String(data.unit ?? ''),
    timestamp,
    quality: (data.quality as SensorReading['quality']) ?? 'GOOD',
    source: (data.source as SensorReading['source']) ?? 'ESP32',
  };
}

function collapseToLatest(readings: SensorReading[]): LatestReadings {
  const latest: LatestReadings = {};
  for (const reading of readings) {
    const existing = latest[reading.sensorType];
    if (!existing || new Date(reading.timestamp) > new Date(existing.timestamp)) {
      latest[reading.sensorType] = reading;
    }
  }
  return latest;
}

export class FirebaseTelemetryRepository implements TelemetryRepository {
  private latestQuery(farmId: string, zoneId?: string) {
    const base = collection(getDb(), COLLECTIONS.latestReadings);
    return zoneId
      ? query(base, where('farmId', '==', farmId), where('zoneId', '==', zoneId))
      : query(base, where('farmId', '==', farmId));
  }

  async getLatestReadings(farmId: string, zoneId?: string): Promise<LatestReadings> {
    const snapshot = await getDocs(this.latestQuery(farmId, zoneId));
    const readings = snapshot.docs
      .map((d) => mapReading(d.data(), d.id))
      .filter((r): r is SensorReading => r !== null);
    return collapseToLatest(readings);
  }

  subscribeToLatestReadings(
    farmId: string,
    zoneId: string | undefined,
    onChange: (readings: LatestReadings) => void,
    onError: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      this.latestQuery(farmId, zoneId),
      (snapshot) => {
        const readings = snapshot.docs
          .map((d) => mapReading(d.data(), d.id))
          .filter((r): r is SensorReading => r !== null);
        onChange(collapseToLatest(readings));
      },
      (error) => onError(error as Error),
    );
  }

  async getHistory(params: {
    farmId: string;
    zoneId?: string;
    sensorType: SensorType;
    from: string;
    to: string;
    bucket?: 'raw' | 'hour' | 'day' | 'month';
  }): Promise<TimeSeries> {
    const constraints = [
      where('farmId', '==', params.farmId),
      where('sensorType', '==', params.sensorType),
      where('timestamp', '>=', new Date(params.from)),
      where('timestamp', '<=', new Date(params.to)),
      orderBy('timestamp', 'asc'),
      fbLimit(5000),
    ];
    if (params.zoneId) constraints.unshift(where('zoneId', '==', params.zoneId));

    const snapshot = await getDocs(query(collection(getDb(), COLLECTIONS.sensorReadings), ...constraints));
    const readings = snapshot.docs
      .map((d) => mapReading(d.data(), d.id))
      .filter((r): r is SensorReading => r !== null);

    const points: TimeSeriesPoint[] = readings.map((r) => ({ timestamp: r.timestamp, value: r.value }));
    return {
      sensorType: params.sensorType,
      zoneId: params.zoneId,
      unit: readings[0]?.unit ?? '',
      points: params.bucket && params.bucket !== 'raw' ? bucketPoints(points, params.bucket) : points,
    };
  }

  /**
   * Comparison is derived only from stored readings. When either period holds no
   * data, sufficientData is false and the UI shows the insufficient-history
   * message instead of a number.
   */
  async getComparison(params: {
    farmId: string;
    zoneId?: string;
    metric: Parameters<TelemetryRepository['getComparison']>[0]['metric'];
    period: ComparisonResult extends never ? never : Parameters<TelemetryRepository['getComparison']>[0]['period'];
  }): Promise<ComparisonResult> {
    // Aggregate documents are written by the backend; the client never computes
    // a comparison from data it invented.
    const id = [params.farmId, params.zoneId ?? 'farm', params.metric, params.period].join('__');
    const snapshot = await getDoc(doc(getDb(), 'comparisons', id));

    if (!snapshot.exists()) {
      return {
        metric: String(params.metric),
        unit: '',
        currentValue: null,
        previousValue: null,
        absoluteDifference: null,
        percentageDifference: null,
        trend: 'UNKNOWN',
        sufficientData: false,
      };
    }

    const data = snapshot.data();
    const current = toNumber(data.currentValue) ?? null;
    const previous = toNumber(data.previousValue) ?? null;
    const sufficient = current !== null && previous !== null;
    const absolute = sufficient ? current - previous : null;
    const percentage = sufficient && previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;

    return {
      metric: String(params.metric),
      unit: String(data.unit ?? ''),
      currentValue: current,
      previousValue: previous,
      absoluteDifference: absolute,
      percentageDifference: percentage,
      trend: absolute === null ? 'UNKNOWN' : absolute > 0 ? 'UP' : absolute < 0 ? 'DOWN' : 'FLAT',
      sufficientData: sufficient,
    };
  }
}

/** Averages readings into hour, day or month buckets. Empty input stays empty. */
function bucketPoints(points: TimeSeriesPoint[], bucket: 'hour' | 'day' | 'month'): TimeSeriesPoint[] {
  const groups = new Map<string, number[]>();
  for (const point of points) {
    const date = new Date(point.timestamp);
    const key =
      bucket === 'hour'
        ? `${date.toISOString().slice(0, 13)}:00:00.000Z`
        : bucket === 'day'
          ? `${date.toISOString().slice(0, 10)}T00:00:00.000Z`
          : `${date.toISOString().slice(0, 7)}-01T00:00:00.000Z`;
    const list = groups.get(key);
    if (list) list.push(point.value);
    else groups.set(key, [point.value]);
  }
  return [...groups.entries()]
    .map(([timestamp, values]) => ({
      timestamp,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
