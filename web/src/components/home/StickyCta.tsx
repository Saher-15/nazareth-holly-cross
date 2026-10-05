'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Flame from './Flame';
import styles from './StickyCta.module.css';

// A small "light a candle" button that slides in once the hero has scrolled away,
// and steps aside again over the footer so it never covers its links.
export default function StickyCta({ watchId }: { watchId: string }) {
  const t = useTranslations('home');
  const [heroVisible, setHeroVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const hero = document.getElementById(watchId);
    const footer = document.querySelector('body > footer, footer');
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) setHeroVisible(entry.isIntersecting);
        else setFooterVisible(entry.isIntersecting);
      }
    });
    if (hero) io.observe(hero);
    if (footer) io.observe(footer);
    return () => io.disconnect();
  }, [watchId]);

  const shown = !heroVisible && !footerVisible;

  return (
    <Link
      href="/candle"
      className={`ui-btn ui-btn--gold ${styles.sticky} ${shown ? styles.shown : ''}`}
      data-shown={shown}
    >
      <Flame size="sm" />
      {t('stickyCandle')}
    </Link>
  );
}
