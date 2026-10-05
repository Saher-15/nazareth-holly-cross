'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Reveal from '@/components/ui/Reveal';
import Flame from '@/components/ui/Flame';
import { FLAMES_KEY, localDay, MAX_CANDLES_SHOWN, parseFlames, serializeFlames } from './flames';
import styles from './CandleStrip.module.css';

// --- a tiny store over localStorage (falls back to memory when storage is blocked) ---
let memoryCount = 0;
const listeners = new Set<() => void>();

function readCount(): number {
  try {
    return parseFlames(localStorage.getItem(FLAMES_KEY), localDay());
  } catch {
    return memoryCount;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === FLAMES_KEY && onChange();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function lightOne() {
  const next = readCount() + 1;
  memoryCount = next;
  try {
    localStorage.setItem(FLAMES_KEY, serializeFlames(next, localDay()));
  } catch {
    // private mode: the flame still shows for this visit
  }
  listeners.forEach((notify) => notify());
}

// A symbolic flame counter kept on this device, next to the real way to have a
// candle lit in Nazareth (the candle page).
export default function CandleStrip({ id }: { id: string }) {
  const t = useTranslations();
  const count = useSyncExternalStore(subscribe, readCount, () => 0);

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <Reveal className={`ui-container ${styles.inner}`}>
        <div className={styles.copy}>
          <h2 id={`${id}-title`} className="ui-h2">
            {t('home.candleTitle')}
          </h2>
          <p className={styles.text}>{t('home.candleText')}</p>
          <div className={styles.actions}>
            <Link href="/candle" className="ui-btn ui-btn--gold">
              {t('heroSection.lightCandle')}
            </Link>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={lightOne}>
              <Flame size="sm" />
              {t('home.flameBtn')}
            </button>
          </div>
          <p className={styles.note}>{t('home.flameNote')}</p>
        </div>

        <div className={styles.stage}>
          <ul className={styles.candles} aria-hidden="true">
            {Array.from({ length: MAX_CANDLES_SHOWN }, (_, i) => (
              <li key={i} className={i < count ? styles.lit : undefined} style={{ '--i': i } as CSSProperties}>
                <Flame className={styles.flame} />
                <span className={styles.wax} />
              </li>
            ))}
          </ul>
          <p className={styles.count} role="status" aria-live="polite">
            {t('home.flameCount', { count })}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
