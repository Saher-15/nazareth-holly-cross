'use client';

import { useTranslations } from 'next-intl';
import { HEADER_POLL_MS } from '@/lib/liveStatusStore';
import { useLiveStatus, type LiveSeed } from '@/lib/useLiveStatus';
import styles from './SiteHeader.module.css';

// Inside the header's Live link (desktop bar and phone drawer, every page): a red dot that pulses while a broadcast is
// live (still under reduced motion and the panel's "Stop animations"), with words for screen readers. It follows the
// tab's one live-status poller (lib/liveStatusStore.ts, every 30 seconds while the tab is visible), so it appears and
// disappears without a reload; it starts from what the server knew (`seed`, lib/liveStatusPeek.ts).
export default function LiveNavIndicator({ seed }: { seed?: LiveSeed }) {
  const t = useTranslations('site.nav');
  const status = useLiveStatus(HEADER_POLL_MS, seed);
  if (!status.live) return null;
  return (
    <>
      <span className={styles.liveDot} aria-hidden="true" data-testid="nav-live-now" />{' '}
      <span className="visually-hidden">{t('liveNow')}</span>
    </>
  );
}
