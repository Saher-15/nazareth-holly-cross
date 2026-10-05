'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { scrollBehavior } from '@/lib/motion';
import Reveal from '@/components/ui/Reveal';
import { ArrowEnd, ChevronEnd, ChevronStart } from './icons';
import { homeSites } from './sites';
import styles from './SitesCarousel.module.css';

const GAP = 16;

const isRtl = (el: HTMLElement) => getComputedStyle(el).direction === 'rtl';

// Horizontal scroll-snap carousel of the holy sites. Touch swipe is native scrolling;
// mouse drag, the arrow buttons and the keyboard (arrows, Home, End on the focused
// track) are added on top. Works in both reading directions.
export default function SitesCarousel({ id }: { id: string }) {
  const t = useTranslations('home');
  const tPage = useTranslations('homePage');
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  // In RTL, scrollLeft runs from 0 (start) down to negative values, so measure its size.
  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth - 2;
    const offset = Math.abs(el.scrollLeft);
    setEdges((prev) => {
      const next = { atStart: offset <= 2, atEnd: offset >= max };
      return prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next;
    });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
    };
  }, [measure]);

  const cardStep = () => {
    const card = trackRef.current?.querySelector('li');
    return card ? card.getBoundingClientRect().width + GAP : 300;
  };

  /** Scrolls by whole cards; `dir` is +1 towards the end of the reading direction. */
  const go = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const physical = isRtl(el) ? -dir : dir;
    el.scrollBy({ left: physical * cardStep(), behavior: scrollBehavior() });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el || e.target !== el) return; // focused cards keep their own keys
    const behavior = scrollBehavior();
    const rtl = isRtl(el);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      el.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * cardStep(), behavior });
    } else if (e.key === 'Home') {
      e.preventDefault();
      el.scrollTo({ left: 0, behavior });
    } else if (e.key === 'End') {
      e.preventDefault();
      el.scrollTo({ left: rtl ? -el.scrollWidth : el.scrollWidth, behavior });
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !trackRef.current) return;
    drag.current = { active: true, startX: e.clientX, startLeft: trackRef.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true;
      el.classList.add(styles.dragging);
    }
    if (d.moved) el.scrollLeft = d.startLeft - dx;
  };
  const endDrag = () => {
    drag.current.active = false;
    trackRef.current?.classList.remove(styles.dragging);
  };
  // A drag must not count as a click on the card underneath.
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <Reveal>
        <div className={`ui-container ${styles.head}`}>
          <div>
            <p className="ui-eyebrow">{t('sitesEyebrow')}</p>
            <h2 id={`${id}-title`} className={`ui-h2 ${styles.title}`}>
              {t('sitesTitle')}
            </h2>
          </div>
          <div className={styles.arrows}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => !edges.atStart && go(-1)}
              aria-disabled={edges.atStart}
              aria-controls={`${id}-track`}
              aria-label={t('prev')}
            >
              <ChevronStart className={styles.mirror} />
            </button>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => !edges.atEnd && go(1)}
              aria-disabled={edges.atEnd}
              aria-controls={`${id}-track`}
              aria-label={t('next')}
            >
              <ChevronEnd className={styles.mirror} />
            </button>
          </div>
        </div>

        {/* Read by screen readers when the track gets keyboard focus. */}
        <p id={`${id}-hint`} className="visually-hidden">
          {tPage('carouselHint')}
        </p>
        <div
          id={`${id}-track`}
          ref={trackRef}
          className={styles.track}
          role="region"
          aria-label={t('sitesLabel')}
          aria-describedby={`${id}-hint`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onScroll={measure}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
        >
          <ul className={styles.list}>
            {homeSites.map((site) => (
              <li key={site.href} className={styles.item}>
                <Link href={site.href} className={styles.card} draggable={false}>
                  <Image
                    className={styles.img}
                    src={site.img}
                    alt=""
                    fill
                    sizes="(min-width: 1000px) 320px, min(78vw, 340px)"
                    draggable={false}
                  />
                  <span className={styles.cardShade} aria-hidden="true" />
                  <span className={styles.body}>
                    <span className={styles.name}>{t(site.nameKey)}</span>
                    <span className={styles.go}>
                      {t('explore')} <ArrowEnd className={styles.mirror} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
