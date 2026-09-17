/**
 * Decorative orchard panel used beside the authentication cards. Illustration
 * only — it carries no readings.
 */
export function OrchardPanel({ heading, body }: { heading: string; body: string }) {
  return (
    <aside className="relative hidden overflow-hidden bg-canopy p-12 text-white lg:flex lg:flex-col lg:justify-end">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {Array.from({ length: 18 }).map((_, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const x = 60 + col * 140 - row * 12;
          const y = 120 + row * 85;
          const r = 34 - row * 2;
          return (
            <g key={i}>
              <rect x={x - 3} y={y} width="6" height={r} fill="#4a332b" />
              <circle cx={x} cy={y} r={r} fill="#4CAF50" />
              <circle cx={x - r * 0.35} cy={y - r * 0.3} r={r * 0.6} fill="#66BB6A" />
            </g>
          );
        })}
      </svg>
      <div className="relative">
        <h2 className="font-display text-display-md font-semibold">{heading}</h2>
        <p className="mt-4 max-w-md leading-relaxed text-white/75">{body}</p>
      </div>
    </aside>
  );
}
