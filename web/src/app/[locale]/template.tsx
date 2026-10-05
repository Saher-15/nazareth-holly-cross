'use client';

import { ViewTransition, type ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';

// Page transitions. React's <ViewTransition> (Next 16 enables it without configuration) uses the browser's
// View Transitions API: the old page fades out, the new one fades in with a small rise (the CSS for the
// `page-out` / `page-in` classes is in styles/globals.css). Browsers without the API, and visitors who
// prefer reduced motion, just get the normal instant navigation.
// Keyed by path so that moving between two pages of the same section (one holy site to the next) animates too.
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
