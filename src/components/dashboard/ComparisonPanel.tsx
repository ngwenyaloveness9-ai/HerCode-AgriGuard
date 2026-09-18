import { useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { useComparison } from '@/hooks/useTelemetry';
import { LoadingState } from '@/components/common/DataState';
import { formatDelta, formatReading, NO_VALUE } from '@/utils/format';
import type { ComparisonPeriod } from '@/types';

const PERIODS: { value: ComparisonPeriod; label: string; caption: string }[] = [
  { value: 'TODAY', label: 'Today', caption: 'Today so far' },
  { value: 'DAY', label: 'Day', caption: 'Today vs yesterday' },
  { value: 'WEEK', label: 'Week', caption: 'This week vs last week' },
  { value: 'MONTH', label: 'Month', caption: 'This month vs last month' },
  { value: 'YEAR', label: 'Year', caption: 'This year vs last year' },
];

const METRICS = [
  { key: 'SOIL_MOISTURE', label: 'Soil moisture' },
  { key: 'AMBIENT_TEMPERATURE', label: 'Ambient temperature' },
  { key: 'WATER_VOLUME', label: 'Water used' },
  { key: 'IRRIGATION_DURATION', label: 'Irrigation duration' },
] as const;

/**
 * Comparisons are read from stored aggregates. When the backend has not held
 * enough history, the tile says so rather than showing a computed-looking zero.
 */
export function ComparisonPanel({ farmId }: { farmId: string | null }) {
  const [period, setPeriod] = useState<ComparisonPeriod>('DAY');
  const caption = PERIODS.find((p) => p.value === period)?.caption ?? '';

  return (
    <section className="rounded-card border border-forest/8 bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Period comparison</h2>
          <p className="text-sm text-ink/55">{caption}</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-pill bg-forest/5 p-1" role="tablist" aria-label="Comparison period">
          {PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={`rounded-pill px-3 py-1.5 text-sm transition-colors ${
                period === option.value ? 'bg-card font-medium text-forest shadow-sm' : 'text-ink/60 hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((metric) => (
          <ComparisonTile key={metric.key} farmId={farmId} metric={metric.key} label={metric.label} period={period} />
        ))}
      </div>
    </section>
  );
}

function ComparisonTile({
  farmId,
  metric,
  label,
  period,
}: {
  farmId: string | null;
  metric: (typeof METRICS)[number]['key'];
  label: string;
  period: ComparisonPeriod;
}) {
  const { data, isLoading, error } = useComparison({ farmId, metric, period });

  return (
    <article className="rounded-xl border border-forest/8 p-4">
      <p className="text-sm text-ink/60">{label}</p>

      {isLoading ? (
        <LoadingState rows={2} label={`Loading ${label}`} />
      ) : error ? (
        <p className="mt-2 text-sm text-critical">Comparison unavailable</p>
      ) : !data || !data.sufficientData ? (
        <>
          <p className="mt-2 font-display text-2xl font-semibold text-ink/35">{NO_VALUE}</p>
          <p className="mt-1 text-xs text-ink/50">Insufficient historical data for comparison.</p>
        </>
      ) : (
        <>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">
            {formatReading(data.currentValue, data.unit)}
          </p>
          <p
            className={`mt-1 inline-flex items-center gap-1 text-sm ${
              data.trend === 'UP' ? 'text-agri' : data.trend === 'DOWN' ? 'text-warn' : 'text-ink/55'
            }`}
          >
            {data.trend === 'UP' ? (
              <ArrowUpRight size={14} aria-hidden="true" />
            ) : data.trend === 'DOWN' ? (
              <ArrowDownRight size={14} aria-hidden="true" />
            ) : (
              <ArrowRight size={14} aria-hidden="true" />
            )}
            {formatDelta(data.absoluteDifference, data.unit)}
            {data.percentageDifference !== null ? ` (${data.percentageDifference.toFixed(1)}%)` : ''}
          </p>
          <p className="mt-1 text-xs text-ink/45">
            Previous: {formatReading(data.previousValue, data.unit)}
          </p>
        </>
      )}
    </article>
  );
}
