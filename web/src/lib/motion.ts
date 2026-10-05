// Motion preferences. Browser only: call these from effects and event handlers, never while rendering
// on the server.

export const REDUCE_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the visitor asked the system for less motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && (window.matchMedia?.(REDUCE_MOTION_QUERY).matches ?? false);

/** The `behavior` to pass to `scrollTo`/`scrollIntoView`: smooth, unless the visitor asked for less motion. */
export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');
