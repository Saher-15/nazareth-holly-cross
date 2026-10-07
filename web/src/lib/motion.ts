// Motion preferences. Browser only: call these from effects and event handlers, never while rendering
// on the server.

import { A11Y_EVENT } from './a11y';

export const REDUCE_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the visitor's system asks for less motion (the media query alone). */
export const systemReducesMotion = (): boolean =>
  typeof window !== 'undefined' && (window.matchMedia?.(REDUCE_MOTION_QUERY).matches ?? false);

/** True when the visitor asked for less motion: in the system settings, or with "Stop animations" in the
 *  accessibility panel (which marks <html data-a11y-motion="reduce">). */
export const prefersReducedMotion = (): boolean =>
  systemReducesMotion() ||
  (typeof document !== 'undefined' && document.documentElement.getAttribute('data-a11y-motion') === 'reduce');

/** Calls `onChange` when either source of the motion preference changes; returns the unsubscribe function. */
export function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCE_MOTION_QUERY);
  query?.addEventListener('change', onChange);
  window.addEventListener(A11Y_EVENT, onChange);
  return () => {
    query?.removeEventListener('change', onChange);
    window.removeEventListener(A11Y_EVENT, onChange);
  };
}

/** The `behavior` to pass to `scrollTo`/`scrollIntoView`: smooth, unless the visitor asked for less motion. */
export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');

/**
 * Moves keyboard focus from code (the first invalid field after a submit, a "message sent" heading, an error) and makes
 * sure the element is on screen. `html { scroll-behavior: smooth }` makes the browser's own scroll-on-focus animate,
 * and a smooth scroll that is still running (started by focusing the submit button a moment before) carried the page
 * past the newly focused element: focus ended up above the screen (WCAG 2.4.11). An instant scroll stops that
 * animation and puts the element in the middle of the screen; the focus itself then does not scroll again.
 */
export function moveFocus(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'instant' });
  el.focus({ preventScroll: true });
}
