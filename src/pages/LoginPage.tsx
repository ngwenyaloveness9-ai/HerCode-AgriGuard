import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Leaf } from 'lucide-react';
import { TextField } from '@/components/common/Field';
import { OrchardPanel } from '@/components/landing/OrchardPanel';
import { ErrorState } from '@/components/common/DataState';
import { useAuth } from '@/contexts/AuthContext';
import { loginSchema, type LoginValues } from '@/schemas/auth';

/** Authentication is performed by Firebase. Nothing here simulates a session. */
export function LoginPage() {
  const { signIn, resetPassword, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { remember: true } });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    setResetNotice(null);
    try {
      await signIn(values.email, values.password, values.remember);
      const target = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(target, { replace: true });
    } catch (error) {
      setFormError(toMessage(error));
    }
  };

  const onReset = async () => {
    const email = getValues('email');
    if (!email) {
      setFormError('Enter your email address first, then request a reset link.');
      return;
    }
    setFormError(null);
    try {
      await resetPassword(email);
      setResetNotice(`If an account exists for ${email}, a reset link is on its way.`);
    } catch (error) {
      setFormError(toMessage(error));
    }
  };

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-2">
      <OrchardPanel
        heading="Your orchard, as it stands right now"
        body="Sign in to see live root-zone conditions, irrigation state and controller health across every block."
      />

      <main className="flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 inline-flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-canopy">
              <Leaf size={19} className="text-fresh" aria-hidden="true" />
            </span>
            <span className="font-display font-semibold">AgriGuard 3D</span>
          </Link>

          <h1 className="font-display text-display-md font-semibold text-ink">Log in</h1>
          <p className="mt-2 text-sm text-ink/60">Use the account your farm administrator created for you.</p>

          {!configured ? (
            <div className="mt-6">
              <ErrorState
                title="Authentication is not available"
                description="Firebase is not configured for this deployment. Set the VITE_FIREBASE_* variables and reload."
              />
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <input type="checkbox" className="h-4 w-4 rounded border-forest/25 text-agri" {...register('remember')} />
                Remember me
              </label>
              <button type="button" onClick={onReset} className="text-sm font-medium text-agri hover:underline">
                Forgot password?
              </button>
            </div>

            {formError ? <ErrorState title="Could not sign you in" description={formError} /> : null}
            {resetNotice ? (
              <p role="status" className="rounded-card border border-leaf/30 bg-leaf/[0.07] px-4 py-3 text-sm text-forest">
                {resetNotice}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || !configured}
              className="w-full rounded-pill bg-forest py-3 font-semibold text-white transition-colors hover:bg-agri disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink/60">
            No account yet?{' '}
            <Link to="/register" className="font-medium text-agri hover:underline">
              Register your farm
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function toMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'That email and password combination was not recognised.';
  }
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.';
  if (code === 'auth/network-request-failed') return 'No connection to the authentication service.';
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}
