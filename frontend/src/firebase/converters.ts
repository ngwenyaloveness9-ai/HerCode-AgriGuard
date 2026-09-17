import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

/**
 * Firestore stores times as Timestamp; the domain model uses ISO strings.
 * A missing or unparseable time is returned as undefined so the UI can show
 * "unknown" rather than an invented date.
 */
export function toISO(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

export function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function docToRecord<T>(snapshot: QueryDocumentSnapshot<DocumentData>, map: (data: DocumentData, id: string) => T): T {
  return map(snapshot.data(), snapshot.id);
}
