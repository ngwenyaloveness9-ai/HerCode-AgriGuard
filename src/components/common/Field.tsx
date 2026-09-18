import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className, ...props },
  ref,
) {
  const fieldId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink/80">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          'w-full rounded-lg border bg-white px-3.5 py-2.5 text-ink transition-colors placeholder:text-ink/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-agri',
          error ? 'border-critical' : 'border-forest/15',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-ink/55">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
