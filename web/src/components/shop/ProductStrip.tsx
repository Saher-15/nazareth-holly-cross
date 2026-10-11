'use client';

import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { prefersReducedMotion } from '@/lib/motion';
import type { CardItem } from '@/lib/shop/items';
import ProductCard from './ProductCard';
import ShopIcon from './ShopIcon';
import styles from './ProductStrip.module.css';

type Props = {
  id: string;
  title: string;
  lead?: string;
  items: CardItem[];
};

const reducedMotion = prefersReducedMotion;
const isRtl = (el: HTMLElement) => getComputedStyle(el).direction === 'rtl';

// A horizontal row of product cards (best sellers or the shop's favourites). Touch and
// trackpads scroll it natively; the arrow buttons and the keyboard (arrows, Home, End on
// the focused row, Tab through the cards) work in both reading directions.
export default function ProductStrip({ id, title, lead, items }: Props) {
  const t = useTranslations('shopFeatures.strip');
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  // In RTL, scrollLeft runs from 0 (start) down to negative values, so measure its size.
  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const offset = Math.abs(el.scrollLeft);
    const next = { atStart: offset <= 2, atEnd: offset >= el.scrollWidth - el.clientWidth - 2 };
    setEdges((prev) => (prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next));
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

  /** Scrolls by about one view; `dir` is +1 towards the end of the reading direction. */
  const go = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(200, el.clientWidth * 0.8);
    el.scrollBy({ left: (isRtl(el) ? -dir : dir) * step, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el || e.target !== el) return; // a focused card keeps its own keys
    const behavior: ScrollBehavior = reducedMotion() ? 'auto' : 'smooth';
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      el.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * Math.max(200, el.clientWidth * 0.5), behavior });
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const toEnd = e.key === 'End';
      el.scrollTo({ left: toEnd ? (isRtl(el) ? -el.scrollWidth : el.scrollWidth) : 0, behavior });
    }
  };

  // A card that takes the focus (Tab) is brought wholly into the visible part of the row: the browser scrolls only as
  // far as the focused control itself, and scroll snapping can then leave the card, or the heart in its corner, cut by
  // the edge (audit 2026-10-10, F10; WCAG 2.4.11). Physical distances, so it is the same in both reading directions.
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el || e.target === el) return;
    // keyboard focus only: scrolling on a mouse press would move the row under the pointer before the click lands
    if (!(e.target as HTMLElement).matches(':focus-visible')) return;
    const card = (e.target as HTMLElement).closest('li');
    if (!card) return;
    const view = el.getBoundingClientRect();
    const box = card.getBoundingClientRect();
    const margin = 8;
    const delta = box.left < view.left + margin ? box.left - view.left - margin : box.right > view.right - margin ? box.right - view.right + margin : 0;
    if (delta !== 0) el.scrollBy({ left: delta, behavior: 'auto' });
  };

  if (!items.length) return null;

  return (
    <section className={styles.strip} aria-labelledby={`${id}-title`} data-testid="product-strip">
      <div className={styles.head}>
        <div>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          {lead && <p className={styles.lead}>{lead}</p>}
        </div>
        <div className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => !edges.atStart && go(-1)}
            aria-disabled={edges.atStart}
            aria-controls={`${id}-track`}
            aria-label={t('back')}
          >
            <ShopIcon name="chevronStart" />
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => !edges.atEnd && go(1)}
            aria-disabled={edges.atEnd}
            aria-controls={`${id}-track`}
            aria-label={t('forward')}
          >
            <ShopIcon name="chevronEnd" />
          </button>
        </div>
      </div>
      <div
        id={`${id}-track`}
        ref={trackRef}
        className={styles.track}
        data-more-start={edges.atStart ? undefined : ''}
        data-more-end={edges.atEnd ? undefined : ''}
        role="region"
        aria-label={title}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onScroll={measure}
      >
        <ul className={styles.list}>
          {items.map((item, i) => (
            <li key={item._id} className={styles.item}>
              <ProductCard item={item} index={i} sizes="(min-width: 700px) 230px, 46vw" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
