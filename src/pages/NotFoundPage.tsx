import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div>
        <p className="font-mono text-sm text-agri">404</p>
        <h1 className="mt-2 font-display text-display-md font-semibold text-ink">This page does not exist</h1>
        <p className="mt-3 text-ink/60">The link may be out of date, or the section may have moved.</p>
        <Link to="/dashboard" className="mt-7 inline-block rounded-pill bg-forest px-5 py-2.5 font-semibold text-white">
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
