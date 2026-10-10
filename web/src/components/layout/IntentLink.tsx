'use client';

import { useState, type ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';

type Props = ComponentProps<typeof Link>;

/**
 * A `Link` that prefetches its page only when the visitor shows intent: the pointer rests on it, it gets keyboard
 * focus, or a finger touches it. Used for the big link sets every page carries (the header menu and the footer).
 *
 * Why: every page is rendered per request (the CSP nonce, docs/PERFORMANCE.md), so a prefetch cannot be served from a
 * cache. With the default (prefetch when the link enters the viewport) each page view fired 15 to 42 prefetch
 * requests for the header and footer links, each a full server render of 16-74 kB, competing on a phone with the hero
 * photo and the fonts. A hover or a touch still starts the prefetch 100-300 ms before the click lands, which is
 * most of the benefit for the one link the visitor is about to follow.
 */
export default function IntentLink({ prefetch, onPointerEnter, onFocus, onTouchStart, ...props }: Props) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      // null = Next's default prefetch (from the moment of intent on); false = none yet.
      prefetch={prefetch === false ? false : intent ? (prefetch ?? null) : false}
      onPointerEnter={(event) => {
        setIntent(true);
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
