import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { Permission } from '@/contexts/AuthContext';

/** Gate for authenticated routes. Unresolved auth never renders farm data. */
export function ProtectedRoute({ requires }: { requires?: Permission }) {
  const { firebaseUser, initialising, can, profile } = useAuth();
  const location = useLocation();

  if (initialising) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas text-ink/55" role="status">
        Checking your session
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requires && profile && !can(requires)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">You do not have access to this section</h1>
          <p className="mt-2 text-sm text-ink/60">Ask your farm administrator to adjust your role.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
