'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { formatElapsed } from '@/lib/media';
import { PreviewSlot, useLiveBroadcast, useTicker } from './LiveBroadcast';

// The compact "LIVE 12:34 - End broadcast" bar on every dashboard page but the Live page itself, while this tab is
// broadcasting (LiveBroadcast.tsx keeps the broadcast going between pages). It also shows the recording's upload when
// the admin is elsewhere, so nobody closes the tab without knowing something is still being sent.

export function LiveBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const live = useLiveBroadcast();
  const id = useId();
  const onAir = live.phase === 'starting' || live.phase === 'live' || live.phase === 'ending';
  const uploading = live.uploadView.phase !== 'idle' && live.uploadView.phase !== 'done';
  const now = useTicker(onAir && pathname !== '/live');
  if (pathname === '/live' || (!onAir && !uploading)) return null;

  const percent = live.uploadView.total ? Math.min(100, Math.floor((live.uploadView.sent / live.uploadView.total) * 100)) : 0;
  const elapsed = live.liveSince ? formatElapsed(Math.max(0, now - live.liveSince)) : '';
  const state =
    live.phase === 'starting' || (live.phase === 'live' && (live.whipState === 'connecting' || live.whipState === 'idle'))
      ? t('live.connecting')
      : live.whipState === 'reconnecting'
        ? t('live.reconnecting')
        : live.whipState === 'failed'
          ? t('live.bar.lost')
          : '';

  return (
    <section className="live-bar" aria-labelledby={`${id}-title`} data-testid="live-bar" data-state={onAir ? 'live' : 'upload'}>
      {onAir ? (
        <>
          <PreviewSlot className="live-bar__thumb" videoClassName={`live-bar__video${live.mirrored ? ' studio__video--mirror' : ''}`} label={t('live.previewLabel')} />
          <h2 id={`${id}-title`} className="live-bar__title">
            <span className="live-badge">
              <span className="live-badge__dot" aria-hidden="true" />
              {t('live.badge')}
              {elapsed ? <span className="live-badge__time ltr" data-testid="live-bar-elapsed">{elapsed}</span> : null}
            </span>
            <span className="live-bar__name" dir="auto">{live.session?.title ?? ''}</span>
          </h2>
          {state ? <p className={`live-bar__state${live.whipState === 'failed' ? ' live-bar__state--error' : ''}`}>{state}</p> : null}
          <div className="live-bar__actions">
            <Link className="btn btn--ghost btn--sm" href="/live" data-testid="live-bar-studio">
              <Icon name="broadcast" size={16} />
              <span>{t('live.bar.open')}</span>
            </Link>
            {live.phase === 'live' ? (
              <button type="button" className="btn btn--danger btn--sm" onClick={() => void live.endBroadcast()} data-testid="live-bar-stop">
                <Icon name="stop" size={16} />
                <span>{t('live.stop')}</span>
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <h2 id={`${id}-title`} className="live-bar__title">
            <Icon name="download" size={18} className="icon icon--up" />
            <span>{t('live.bar.uploading', { percent })}</span>
          </h2>
          <progress className="progress live-bar__progress" max={100} value={percent} aria-labelledby={`${id}-title`} />
          <div className="live-bar__actions">
            <Link className="btn btn--ghost btn--sm" href="/live">{t('live.bar.open')}</Link>
          </div>
        </>
      )}
    </section>
  );
}
