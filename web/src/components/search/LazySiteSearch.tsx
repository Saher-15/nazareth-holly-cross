'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { OPEN_SEARCH_EVENT } from './events';

const SiteSearch = dynamic(() => import('./SiteSearch'), { ssr: false });

// The command palette is mounted on every page, but almost nobody opens it. This stand-in costs a few lines of
// code: it waits for Ctrl/Cmd + K or the footer's Search button, and only then fetches the palette (which opens
// at once, so the first press is not lost). From then on the palette listens for those itself.
export default function LazySiteSearch() {
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    if (wanted) return undefined;
    const want = () => setWanted(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        want();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, want);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, want);
    };
  }, [wanted]);

  return wanted ? <SiteSearch defaultOpen /> : null;
}
