import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

/**
 * Placeholder for routes whose screens are still being built. It states plainly
 * that the screen is unfinished rather than showing an empty dashboard that
 * could be mistaken for a farm with no data.
 */
export function PendingPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-forest/15 bg-forest/[0.02] px-6 py-14 text-center">
        <Construction size={26} strokeWidth={1.6} className="text-forest/40" aria-hidden="true" />
        <p className="font-medium text-ink">This screen is still being built</p>
        <p className="max-w-md text-sm text-ink/60">
          The data services behind it are in place. The interface is next in the build queue.
        </p>
      </div>
    </div>
  );
}
