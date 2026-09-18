import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-forest/10 pb-5">
      <div>
        <h1 className="font-display text-display-md font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink/60">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
