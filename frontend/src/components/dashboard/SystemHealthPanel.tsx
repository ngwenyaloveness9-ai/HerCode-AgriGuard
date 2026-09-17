import { Activity } from 'lucide-react';
import { DataState } from '@/components/common/DataState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DEVICE_STATUS_PRESENTATION } from '@/constants/status';
import { formatRelativeTime } from '@/utils/format';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type { SystemHealth } from '@/types';

/**
 * Health is reported, never assumed: a component with no health record shows
 * UNKNOWN rather than ONLINE.
 */
export function SystemHealthPanel({ farmId }: { farmId: string | null }) {
  const { health, loading, error } = useSystemHealth(farmId);

  return (
    <section className="rounded-card border border-forest/8 bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
        <Activity size={18} strokeWidth={1.9} className="text-agri" aria-hidden="true" />
        System health
      </h2>

      <div className="mt-4">
        <DataState<SystemHealth>
          loading={loading}
          error={error}
          data={health}
          emptyTitle="No health report received"
          emptyDescription="The controller has not reported component health for this farm yet."
        >
          {(data) => (
            <div className="space-y-4">
              <ul className="divide-y divide-forest/6">
                {data.components.map((component) => (
                  <li key={component.deviceId} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{component.deviceId}</p>
                      <p className="text-xs text-ink/50">
                        {component.message ?? `Last seen ${formatRelativeTime(component.lastSeen)}`}
                      </p>
                    </div>
                    <StatusBadge presentation={DEVICE_STATUS_PRESENTATION[component.status]} size="sm" />
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-3 gap-2 border-t border-forest/8 pt-4">
                {([
                  ['Network', data.network],
                  ['Backend', data.backend],
                  ['Database', data.database],
                ] as const).map(([label, status]) => (
                  <div key={label}>
                    <p className="text-xs text-ink/55">{label}</p>
                    <StatusBadge presentation={DEVICE_STATUS_PRESENTATION[status]} size="sm" className="mt-1" />
                  </div>
                ))}
              </div>

              {data.reportedAt ? (
                <p className="text-xs text-ink/45">Reported {formatRelativeTime(data.reportedAt)}</p>
              ) : null}
            </div>
          )}
        </DataState>
      </div>
    </section>
  );
}
