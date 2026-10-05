'use client';

import Image from 'next/image';
import { useCallback, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isRtl } from '@/i18n/routing';
import type { Photo } from '@/data/places/places';
import { lastTileSpan, tileOf } from './galleryLogic';
import { ZoomIcon } from './icons';
import Lightbox from './Lightbox';
import styles from './PlaceGallery.module.css';

// Responsive widths of a tile: 2 columns on phones, 3 from 640px, 4 from 1000px (1180px container).
const SIZES = {
  feature: '(min-width: 1000px) 590px, (min-width: 640px) 66vw, 100vw',
  tall: '(min-width: 1000px) 295px, (min-width: 640px) 33vw, 50vw',
  normal: '(min-width: 1000px) 295px, (min-width: 640px) 33vw, 50vw',
  wide: '(min-width: 1000px) 1180px, 100vw',
};

// Stop the shimmer of a tile once its photo has arrived.
const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.parentElement?.setAttribute('data-loaded', '');
};

// Photo grid of one place; a photo opens the full-screen viewer.
export default function PlaceGallery({ photos, name }: { photos: readonly Photo[]; name: string }) {
  const t = useTranslations('placesPage');
  const tHome = useTranslations('home');
  const rtl = isRtl(useLocale());
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const total = photos.length;

  // The last tile widens where needed so each layout (2, 3 and 4 columns) ends on a full row.
  const lastSpans = useMemo(
    () => ({ '--span-2': lastTileSpan(total, 2), '--span-3': lastTileSpan(total, 3), '--span-4': lastTileSpan(total, 4) }),
    [total],
  );
  const lastIsWide = Object.values(lastSpans).some((span) => span > 1);

  const altOf = useCallback((i: number) => t('photoAlt', { place: name, n: i + 1, total }), [t, name, total]);
  const close = useCallback(() => setIndex(null), []);

  return (
    <>
      <ul className={styles.grid}>
        {photos.map((photo, i) => {
          const tile = tileOf(i, total);
          const isLast = i === total - 1 && i > 0;
          return (
            <li
              key={photo.src}
              className={`${styles[tile]} ${isLast ? styles.last : ''}`}
              style={isLast ? (lastSpans as CSSProperties) : undefined}
            >
              <button
                type="button"
                className={styles.thumb}
                aria-haspopup="dialog"
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setIndex(i);
                }}
              >
                <Image
                  src={photo.src}
                  alt={altOf(i)}
                  fill
                  sizes={isLast && lastIsWide ? SIZES.wide : SIZES[tile]}
                  onLoad={markLoaded}
                  onError={markLoaded}
                />
                <span className={styles.zoom} aria-hidden="true">
                  <ZoomIcon size={20} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {index !== null && (
        <Lightbox
          photos={photos}
          index={index}
          onIndexChange={setIndex}
          onClose={close}
          title={name}
          label={t('viewer', { place: name })}
          altOf={altOf}
          labels={{ close: t('close'), prev: tHome('prev'), next: tHome('next') }}
          rtl={rtl}
          returnFocus={opener}
        />
      )}
    </>
  );
}
