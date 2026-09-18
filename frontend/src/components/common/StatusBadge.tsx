import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import type { StatusPresentation } from '@/constants/status';

/**
 * Status is always three signals at once: colour, icon and words. A colour on
 * its own is never allowed to carry the meaning.
 */
export function StatusBadge({
  presentation,
  size = 'md',
  className,
}: {
  presentation: StatusPresentation;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[presentation.icon] ?? Icons.CircleHelp;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        presentation.className,
        className,
      )}
    >
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={2.2} aria-hidden="true" />
      {presentation.label}
    </span>
  );
}
