'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { PauseIcon, PlayIcon } from '@/components/ui/icons';
import { prefersReducedMotion, subscribeMotion } from '@/lib/motion';

/** The event a paused or resumed scope announces (for moving backgrounds). */
export const MOTION_PAUSE_EVENT = 'nhc:motion-pause';
export const MOTION_SCOPE_ATTRIBUTE = 'data-motion-scope';

const moving = () => !prefersReducedMotion();

// Pause and play the moving background of a hero (WCAG 2.2.2: anything that moves by itself for more than five
// seconds can be stopped). It pauses every CSS animation inside the nearest element marked `data-motion-scope`
// (the Ken Burns zoom and the bobbing chevron). Moving media may also listen for MOTION_PAUSE_EVENT.
// Nothing moves when the visitor asked for less motion (system setting or the accessibility panel), so the
// button is not shown then; it is also absent from the server HTML, so it never flashes.
export default function MotionToggle({ className }: { className?: string }) {
  const t = useTranslations('ux.motion');
  const ref = useRef<HTMLButtonElement>(null);
  const [paused, setPaused] = useState(false);
  const shown = useSyncExternalStore(subscribeMotion, moving, () => false);

  if (!shown) return null;

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    const scope = ref.current?.closest<HTMLElement>(`[${MOTION_SCOPE_ATTRIBUTE}]`);
    if (!scope) return;
    if (next) scope.setAttribute('data-motion-paused', 'true');
    else scope.removeAttribute('data-motion-paused');
    scope.dispatchEvent(new CustomEvent(MOTION_PAUSE_EVENT, { detail: { paused: next } }));
  };

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={toggle}
      aria-label={paused ? t('play') : t('pause')}
      data-print="hide"
    >
      {paused ? <PlayIcon size={20} /> : <PauseIcon size={20} />}
    </button>
  );
}
