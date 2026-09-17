import { Link } from 'react-router-dom';
import { Bell, ChevronDown, UserRound } from 'lucide-react';
import { LiveIndicator } from '@/components/common/LiveIndicator';
import { useFarmScope } from '@/contexts/FarmScopeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestReadings } from '@/hooks/useTelemetry';
import { useLiveStatus } from '@/hooks/useLiveStatus';
import { useAlerts } from '@/hooks/useAlerts';

export function TopBar() {
  const { farms, fields, farmId, fieldId, setFarmId, setFieldId } = useFarmScope();
  const { profile } = useAuth();
  const { readings, loading } = useLatestReadings(farmId);
  const { state, lastReadingAt } = useLiveStatus(readings, loading);
  const { active } = useAlerts(farmId);

  const selectClass =
    'rounded-pill border border-forest/12 bg-card px-3 py-1.5 pr-8 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agri disabled:text-ink/40';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-forest/10 bg-canvas/90 px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative">
          <select
            aria-label="Farm"
            className={selectClass}
            value={farmId ?? ''}
            disabled={farms.length === 0}
            onChange={(e) => setFarmId(e.target.value || null)}
          >
            {farms.length === 0 ? <option value="">No farm configured</option> : null}
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden="true" />
        </div>

        <div className="relative hidden sm:block">
          <select
            aria-label="Field"
            className={selectClass}
            value={fieldId ?? ''}
            disabled={fields.length === 0}
            onChange={(e) => setFieldId(e.target.value || null)}
          >
            <option value="">{fields.length === 0 ? 'No fields configured' : 'All fields'}</option>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden="true" />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3 lg:gap-4">
        <LiveIndicator state={state} lastReadingAt={lastReadingAt} />

        <Link
          to="/alerts"
          className="relative grid h-9 w-9 place-items-center rounded-full text-ink/65 transition-colors hover:bg-forest/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agri"
          aria-label={active && active.length > 0 ? `Alerts, ${active.length} active` : 'Alerts'}
        >
          <Bell size={18} strokeWidth={1.9} aria-hidden="true" />
          {active && active.length > 0 ? (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
              {active.length > 9 ? '9+' : active.length}
            </span>
          ) : null}
        </Link>

        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-pill py-1 pl-1 pr-3 text-sm text-ink/75 transition-colors hover:bg-forest/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agri"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-agri/12 text-agri">
            <UserRound size={15} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="hidden max-w-28 truncate md:inline">{profile?.firstName ?? profile?.email ?? 'Profile'}</span>
        </Link>
      </div>
    </header>
  );
}
