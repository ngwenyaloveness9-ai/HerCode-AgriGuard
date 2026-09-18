import { cn } from '@/utils/cn';
import { LIVE_STATE_PRESENTATION } from '@/constants/status';
import { formatRelativeTime } from '@/utils/format';
import type { LiveState } from '@/types';

/**
 * Header connection indicator. The dot pulses only while genuinely live, so the
 * animation itself is a truthful signal.
 */
export function LiveIndicator({
  state,
  lastReadingAt,
  className,
}: {
  state: LiveState;
  lastReadingAt?: string | null;
  className?: string;
}) {
  const presentation = LIVE_STATE_PRESENTATION[state];
  return (
    <span
      className={cn('inline-flex items-center gap-2 text-sm font-medium', presentation.className, className)}
      title={lastReadingAt ? `Last reading ${formatRelativeTime(lastReadingAt)}` : 'No reading received'}
    >
      <span className="relative flex h-2.5 w-2.5">
        {state === 'LIVE' ? (
          <span
            className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-ring motion-reduce:animate-none', presentation.dotClassName)}
            aria-hidden="true"
          />
        ) : null}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', presentation.dotClassName)} aria-hidden="true" />
      </span>
      {presentation.label}
      <span className="sr-only">
        {lastReadingAt ? `Last reading ${formatRelativeTime(lastReadingAt)}` : 'No reading received yet'}
      </span>
    </span>
  );
}
