import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import { cardEntrance } from '@/animations/variants';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { Skeleton } from '@/components/common/DataState';
import { formatRelativeTime } from '@/utils/format';

/**
 * A KPI tile. When no reading exists it shows "--" with the reason underneath,
 * and when the reading is old it says so instead of presenting it as current.
 */
export function MetricCard({
  label,
  value,
  unit,
  decimals = 1,
  icon,
  accent = 'text-agri',
  loading = false,
  stale = false,
  timestamp,
  emptyMessage = 'Waiting for data',
  className,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  decimals?: number;
  icon: string;
  accent?: string;
  loading?: boolean;
  stale?: boolean;
  timestamp?: string | null;
  emptyMessage?: string;
  className?: string;
}) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[icon] ?? Icons.Gauge;
  const hasValue = value !== null && value !== undefined && Number.isFinite(value);

  return (
    <motion.article
      variants={cardEntrance}
      className={cn('rounded-card border border-forest/8 bg-card p-4 shadow-card', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink/60">{label}</p>
        <Icon size={18} strokeWidth={1.8} className={cn('shrink-0', accent)} aria-hidden="true" />
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2 font-display text-3xl font-semibold leading-none text-ink">
          <AnimatedNumber value={hasValue ? value : null} decimals={decimals} />
          {hasValue && unit ? <span className="ml-1 text-base font-medium text-ink/50">{unit}</span> : null}
        </p>
      )}

      <p className="mt-2 text-xs text-ink/50">
        {loading
          ? 'Loading'
          : !hasValue
            ? emptyMessage
            : stale
              ? `Stale data — last reading ${formatRelativeTime(timestamp)}`
              : timestamp
                ? `Updated ${formatRelativeTime(timestamp)}`
                : ''}
      </p>
    </motion.article>
  );
}
