import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { NO_VALUE } from '@/utils/format';

/**
 * Counts from the previous reading to the new one so a change is visible.
 * A null value renders the placeholder — the component never animates up from
 * zero to imply a reading exists.
 */
export function AnimatedNumber({
  value,
  decimals = 1,
  durationMs = 500,
}: {
  value: number | null | undefined;
  decimals?: number;
  durationMs?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState<number | null>(value ?? null);
  const fromRef = useRef<number | null>(value ?? null);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      setDisplayed(null);
      fromRef.current = null;
      return;
    }
    if (reduceMotion || fromRef.current === null) {
      setDisplayed(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayed(from + (value - from) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs, reduceMotion]);

  if (displayed === null) return <span className="text-ink/35">{NO_VALUE}</span>;
  return <span className="tabular-nums">{displayed.toFixed(decimals)}</span>;
}
