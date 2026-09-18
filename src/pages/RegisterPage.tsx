import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Leaf } from 'lucide-react';
import { TextField } from '@/components/common/Field';
import { OrchardPanel } from '@/components/landing/OrchardPanel';
import { ErrorState } from '@/components/common/DataState';
import { useAuth } from '@/contexts/AuthContext';
import { registerSchema, type RegisterValues } from '@/schemas/auth';

export function RegisterPage() {
  const { register: createAccount, configured } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterValues) => {
    setFormError(null);
    try {
      await createAccount({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        organisation: values.organisation,
      });
      navigate('/onboarding', { replace: true });
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      setFormError(
        code === 'auth/email-already-in-use'
          ? 'An account already exists for that email address.'
          : error instanceof Error
            ? error.message
            : 'The account could not be created.',
      );
    }
  };

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-2">
      <OrchardPanel
        heading="Set up your farm once"
        body="Create your account, then walk through adding fields, zones, crop profiles and your controller."
      />

      <main className="flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 inline-flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-canopy">
              <Leaf size={19} className="text-fresh" aria-hidden="true" />
            </span>
            <span className="font-display font-semibold">AgriGuard 3D</span>
          </Link>

          <h1 className="font-display text-display-md font-semibold text-ink">Create your account</h1>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName')} />
              <TextField label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName')} />
            </div>
            <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <TextField
              label="Farm or organisation"
              autoComplete="organization"
              error={errors.organisation?.message}
              {...register('organisation')}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters, with upper and lowercase letters and a number."
              error={errors.password?.message}
              {...register('password')}
            />
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            {formError ? <ErrorState title="Could not create the account" description={formError} /> : null}

            <button
              type="submit"
              disabled={isSubmitting || !configured}
              className="w-full rounded-pill bg-forest py-3 font-semibold text-white transition-colors hover:bg-agri disabled:opacity-60"
            >
              {isSubmitting ? 'Creating account' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink/60">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-agri hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
