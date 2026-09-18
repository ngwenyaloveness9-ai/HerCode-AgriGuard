import { TriangleAlert } from 'lucide-react';
import { useRepositories } from '@/services/repositoryProvider';

/**
 * Shown when the selected data source has no credentials. Without this, empty
 * screens would look like a farm with no sensors rather than an unconfigured app.
 */
export function ConfigurationNotice() {
  const { ready, source } = useRepositories();
  if (ready) return null;

  return (
    <div role="alert" className="flex items-start gap-3 border-b border-warn/30 bg-warn/[0.08] px-4 py-3 lg:px-8">
      <TriangleAlert size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
      <p className="text-sm text-ink/80">
        {source === 'firebase'
          ? 'Firebase is not configured, so no telemetry can be loaded. Set the VITE_FIREBASE_* variables in your environment and reload.'
          : 'The backend URL is not configured, so no telemetry can be loaded. Set VITE_API_BASE_URL in your environment and reload.'}
      </p>
    </div>
  );
}
