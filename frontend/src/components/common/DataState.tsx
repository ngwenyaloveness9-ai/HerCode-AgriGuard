import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CloudOff, Inbox, RefreshCw, TriangleAlert } from 'lucide-react';
import { cn } from '@/utils/cn';
import { fadeIn } from '@/animations/variants';

/**
 * Every data-driven surface renders through these four states. There is no
 * fifth state in which a placeholder number stands in for a reading.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-md bg-forest/[0.06]', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent motion-reduce:animate-none" />
    </div>
  );
}

export function LoadingState({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-forest/15 bg-forest/[0.02] px-6 py-10 text-center"
    >
      <span className="text-forest/40">{icon ?? <Inbox size={26} strokeWidth={1.6} aria-hidden="true" />}</span>
      <p className="font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink/60">{description}</p> : null}
      {action}
    </motion.div>
  );
}

export function ErrorState({
  title = 'This data could not be loaded',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card border border-critical/25 bg-critical/[0.04] px-5 py-4"
    >
      <div className="flex items-center gap-2 text-critical">
        <TriangleAlert size={18} strokeWidth={2} aria-hidden="true" />
        <p className="font-medium">{title}</p>
      </div>
      {description ? <p className="text-sm text-ink/70">{description}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-pill border border-critical/30 px-3 py-1.5 text-sm font-medium text-critical transition-colors hover:bg-critical/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-critical"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function OfflineState({ description }: { description?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-card border border-ink/15 bg-ink/[0.03] px-5 py-4 text-ink/70"
    >
      <CloudOff size={18} strokeWidth={1.8} aria-hidden="true" />
      <p className="text-sm">{description ?? 'No connection to the farm controller.'}</p>
    </div>
  );
}

interface DataStateProps<T> {
  loading: boolean;
  error: Error | null;
  data: T | null | undefined;
  /** True when data loaded successfully but holds nothing. */
  isEmpty?: (data: T) => boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  loadingFallback?: ReactNode;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}

/** Resolves loading / error / empty / ready in one place so pages stay readable. */
export function DataState<T>({
  loading,
  error,
  data,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  loadingFallback,
  onRetry,
  children,
}: DataStateProps<T>) {
  if (loading) return <>{loadingFallback ?? <LoadingState />}</>;
  if (error) return <ErrorState description={error.message} onRetry={onRetry} />;
  if (data === null || data === undefined) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} action={emptyAction} />;
  }
  if (isEmpty?.(data)) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} action={emptyAction} />;
  }
  return <>{children(data)}</>;
}
