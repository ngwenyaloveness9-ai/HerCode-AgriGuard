import type { Variants } from 'framer-motion';

/**
 * Motion is reserved for two jobs: showing a screen has arrived, and showing
 * that something changed. Everything respects prefers-reduced-motion through
 * MotionConfig in App.tsx.
 */

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16 } },
};

export const staggerChildren: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

export const cardEntrance: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.24 } },
};
