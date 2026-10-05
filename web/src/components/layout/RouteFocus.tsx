'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from '@/i18n/navigation';

// After a client-side navigation the old page's focused link is gone and the keyboard would restart
// from the top of the document. Move the focus to <main> instead, so a keyboard or screen-reader
// visitor begins at the new page's content (Next's own route announcer reads the new title).
// A freshly loaded page keeps the browser's normal start: only a changed path moves the focus.
export default function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
