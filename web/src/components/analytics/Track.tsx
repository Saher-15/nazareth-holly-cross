'use client';

import { useEffect, type AnchorHTMLAttributes } from 'react';
import { rememberCampaign, track, type TrackEvent, type TrackFlow } from '@/lib/track';

// The page-side pieces of the cookie-free funnel count (lib/track.ts, docs/ANALYTICS.md). They render nothing of
// their own and never change what the visitor sees.

/** In the layout: notes the campaign of the link the visitor arrived by (in memory only), on the first page. */
export function CampaignCapture() {
  useEffect(() => {
    rememberCampaign();
  }, []);
  return null;
}

/** On a page: counts one opening of it. */
export function TrackView({ flow }: { flow: TrackFlow }) {
  useEffect(() => {
    rememberCampaign();
    track(flow, 'view');
  }, [flow]);
  return null;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { flow: TrackFlow; event: TrackEvent };

/** A plain link (it works before the scripts load) whose press is counted once the scripts have. */
export function TrackedLink({ flow, event, onClick, children, ...rest }: LinkProps) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        track(flow, event);
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
