import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sprout } from 'lucide-react';
import { LiveIndicator } from '@/components/common/LiveIndicator';
import { MetricCard } from '@/components/common/MetricCard';
import { DataState, EmptyState, LoadingState } from '@/components/common/DataState';
import { ZoneCard } from '@/components/dashboard/ZoneCard';
import { SystemHealthPanel } from '@/components/dashboard/SystemHealthPanel';
import { ComparisonPanel } from '@/components/dashboard/ComparisonPanel';
import { useFarmScope } from '@/contexts/FarmScopeContext';
import { useLatestReadings } from '@/hooks/useTelemetry';
import { useLiveStatus } from '@/hooks/useLiveStatus';
import { useEvaluatedZones } from '@/hooks/useZones';
import { useAlerts } from '@/hooks/useAlerts';
import { isStale } from '@/utils/zoneStatus';
import { staggerChildren } from '@/animations/variants';
import type { EvaluatedZone } from '@/hooks/useZones';
import type { LatestReadings, SensorType } from '@/types';

export function DashboardPage() {
  const { farmId, fieldId, farm, loading: scopeLoading } = useFarmScope();
  const { readings, loading: readingsLoading, error: readingsError } = useLatestReadings(farmId);
  const { state, lastReadingAt } = useLiveStatus(readings, readingsLoading);
  const { zones, loading: zonesLoading, error: zonesError } = useEvaluatedZones(farmId, fieldId ?? undefined);
  const { active } = useAlerts(farmId);

  if (scopeLoading) return <LoadingState label="Loading farm" rows={6} />;

  if (!farmId) {
    return (
      <EmptyState
        title="No farm configured"
        description="Add your first farm, field and zone to start receiving telemetry."
        icon={<Sprout size={26} strokeWidth={1.6} aria-hidden="true" />}
        action={
          <Link to="/onboarding" className="mt-2 rounded-pill bg-forest px-5 py-2.5 text-sm font-semibold text-white">
            Set up a farm
          </Link>
        }
      />
    );
  }

  /** Averages across zones. Zones without a reading are excluded, not zeroed. */
  const average = (type: SensorType): { value: number | null; timestamp: string | null } => {
    const values = Object.values(readings ?? {})
      .filter((r) => r?.sensorType === type)
      .map((r) => r!);
    if (values.length === 0) return { value: null, timestamp: null };
    const sum = values.reduce((total, r) => total + r.value, 0);
    const newest = values.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
    return { value: sum / values.length, timestamp: newest.timestamp };
  };

  const single = (type: SensorType) => {
    const reading = readings?.[type];
    return { value: reading?.value ?? null, timestamp: reading?.timestamp ?? null, unit: reading?.unit };
  };

  const moisture = average('SOIL_MOISTURE');
  const soilTemp = average('SOIL_TEMPERATURE');
  const ambient = average('AMBIENT_TEMPERATURE');
  const humidity = average('HUMIDITY');
  const reservoir = single('RESERVOIR_LEVEL');
  const flow = single('FLOW');
  const solar = single('SOLAR_VOLTAGE');
  const battery = single('BATTERY_PERCENT');

  const irrigatingCount = null; // Derived from confirmed device state; see /irrigation.

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display-md font-semibold text-ink">Farm overview</h1>
          <p className="mt-1 text-sm text-ink/60">{farm?.name ?? 'Selected farm'}</p>
        </div>
        <LiveIndicator state={state} lastReadingAt={lastReadingAt} />
      </header>

      {readingsError ? (
        <div className="rounded-card border border-critical/25 bg-critical/[0.04] px-5 py-4 text-sm text-ink/75">
          Telemetry could not be loaded: {readingsError.message}
        </div>
      ) : null}

      <motion.section
        variants={staggerChildren}
        initial="initial"
        animate="animate"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        aria-label="Key metrics"
      >
        <MetricCard label="Average soil moisture" value={moisture.value} unit="%" icon="Droplet" timestamp={moisture.timestamp} stale={isStale(moisture.timestamp ?? undefined)} loading={readingsLoading} accent="text-water" />
        <MetricCard label="Average soil temperature" value={soilTemp.value} unit="°C" icon="Thermometer" timestamp={soilTemp.timestamp} stale={isStale(soilTemp.timestamp ?? undefined)} loading={readingsLoading} accent="text-earth" />
        <MetricCard label="Ambient temperature" value={ambient.value} unit="°C" icon="Sun" timestamp={ambient.timestamp} stale={isStale(ambient.timestamp ?? undefined)} loading={readingsLoading} accent="text-warn" />
        <MetricCard label="Humidity" value={humidity.value} unit="%" icon="Waves" timestamp={humidity.timestamp} stale={isStale(humidity.timestamp ?? undefined)} loading={readingsLoading} accent="text-sky" />
        <MetricCard label="Reservoir level" value={reservoir.value} unit="%" icon="Container" timestamp={reservoir.timestamp} stale={isStale(reservoir.timestamp ?? undefined)} loading={readingsLoading} emptyMessage="Reservoir sensor unavailable" accent="text-water" />
        <MetricCard label="Current water flow" value={flow.value} unit={flow.unit ?? 'L/min'} icon="Gauge" timestamp={flow.timestamp} stale={isStale(flow.timestamp ?? undefined)} loading={readingsLoading} accent="text-water" />
        <MetricCard label="Solar voltage" value={solar.value} unit="V" decimals={2} icon="SunMedium" timestamp={solar.timestamp} stale={isStale(solar.timestamp ?? undefined)} loading={readingsLoading} accent="text-solar" />
        <MetricCard label="Battery charge" value={battery.value} unit="%" decimals={0} icon="BatteryCharging" timestamp={battery.timestamp} stale={isStale(battery.timestamp ?? undefined)} loading={readingsLoading} accent="text-leaf" />
        <MetricCard label="Zones irrigating" value={irrigatingCount} decimals={0} icon="Droplets" loading={readingsLoading} emptyMessage="Awaiting device state" accent="text-water" />
        <MetricCard label="Active alerts" value={active?.length ?? null} decimals={0} icon="Bell" loading={active === null} emptyMessage="No alert data" accent="text-critical" />
      </motion.section>

      <section aria-label="Zones">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Zones</h2>
          <Link to="/zones" className="text-sm font-medium text-agri hover:underline">
            View all zones
          </Link>
        </div>

        <DataState<EvaluatedZone[]>
          loading={zonesLoading}
          error={zonesError}
          data={zones}
          isEmpty={(data) => data.length === 0}
          emptyTitle="No zones configured"
          emptyDescription="Add a zone and assign it a crop profile to start monitoring it."
          emptyAction={
            <Link to="/onboarding" className="mt-2 rounded-pill bg-forest px-5 py-2.5 text-sm font-semibold text-white">
              Add a zone
            </Link>
          }
          loadingFallback={
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-card border border-forest/8 bg-card p-5">
                  <LoadingState rows={5} label="Loading zone" />
                </div>
              ))}
            </div>
          }
        >
          {(data) => (
            <motion.div
              variants={staggerChildren}
              initial="initial"
              animate="animate"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {data.map((evaluated) => (
                <ZoneCard
                  key={evaluated.zone.id}
                  evaluated={evaluated}
                  readings={zoneReadings(readings, evaluated.zone.id)}
                  irrigating={null}
                  shadeDeployed={null}
                />
              ))}
            </motion.div>
          )}
        </DataState>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <ComparisonPanel farmId={farmId} />
        <SystemHealthPanel farmId={farmId} />
      </div>
    </div>
  );
}

function zoneReadings(readings: LatestReadings | null, zoneId: string): LatestReadings {
  if (!readings) return {};
  return Object.fromEntries(Object.entries(readings).filter(([, r]) => r?.zoneId === zoneId));
}
