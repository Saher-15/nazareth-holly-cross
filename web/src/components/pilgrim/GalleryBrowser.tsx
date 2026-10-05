'use client';

import Image from 'next/image';
import { useCallback, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isRtl } from '@/i18n/routing';
import { isPlaceSlug, type Photo, type PlaceSlug } from '@/data/places/places';
import Lightbox from '@/components/places/Lightbox';
import { ZoomIcon } from '@/components/places/icons';
import { replaceQueryString, useQueryString } from '@/lib/urlState';
import styles from './GalleryBrowser.module.css';

export type GalleryItem = { photo: Photo; slug: PlaceSlug; name: string; n: number; total: number };
export type GalleryFilter = { slug: PlaceSlug; name: string; count: number };

const SIZES = '(min-width: 1100px) 290px, (min-width: 700px) 33vw, 50vw';

const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.parentElement?.setAttribute('data-loaded', '');
};

// The gallery: every photo of every holy site in a masonry layout, a filter by site (kept in the URL as
// ?site=latin, so a filtered view can be shared) and the same accessible lightbox the holy sites pages use.
export default function GalleryBrowser({ items, filters }: { items: readonly GalleryItem[]; filters: readonly GalleryFilter[] }) {
  const t = useTranslations('pilgrim.gallery');
  const tPlaces = useTranslations('placesPage');
  const tHome = useTranslations('home');
  const rtl = isRtl(useLocale());
  const search = useQueryString();
  const siteParam = new URLSearchParams(search).get('site') ?? '';
  const site = isPlaceSlug(siteParam) ? siteParam : null;

  const shown = useMemo(() => (site ? items.filter((i) => i.slug === site) : items), [items, site]);
  const photos = useMemo(() => shown.map((i) => i.photo), [shown]);

  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => setIndex(null), []);
  const altOf = useCallback(
    (i: number) => {
      const item = shown[i];
      return item ? tPlaces('photoAlt', { place: item.name, n: item.n, total: item.total }) : '';
    },
    [shown, tPlaces],
  );

  const choose = (next: PlaceSlug | null) => replaceQueryString(next ? `site=${next}` : '');

  return (
    <>
      <div role="group" aria-label={t('filterLabel')} className={styles.filters}>
        <button type="button" className={styles.filter} aria-pressed={!site} onClick={() => choose(null)}>
          {t('all')} <span className={styles.badge}>{items.length}</span>
        </button>
        {filters.map((f) => (
          <button key={f.slug} type="button" className={styles.filter} aria-pressed={site === f.slug} onClick={() => choose(f.slug)}>
            {f.name} <span className={styles.badge}>{f.count}</span>
          </button>
        ))}
      </div>
      <p className={styles.count} role="status">
        {tPlaces('photoCount', { count: shown.length })}
      </p>

      <ul className={styles.masonry}>
        {shown.map((item, i) => (
          <li key={item.photo.src} className={styles.cell}>
            <button
              type="button"
              className={styles.thumb}
              aria-haspopup="dialog"
              style={{ aspectRatio: `${item.photo.width} / ${item.photo.height}` }}
              onClick={(e) => {
                opener.current = e.currentTarget;
                setIndex(i);
              }}
            >
              <Image
                src={item.photo.src}
                alt={altOf(i)}
                width={item.photo.width}
                height={item.photo.height}
                sizes={SIZES}
                onLoad={markLoaded}
                onError={markLoaded}
              />
              <span className={styles.zoom} aria-hidden="true">
                <ZoomIcon size={20} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {index !== null && shown[index] && (
        <Lightbox
          photos={photos}
          index={index}
          onIndexChange={setIndex}
          onClose={close}
          title={shown[index].name}
          label={t('viewer')}
          altOf={altOf}
          labels={{ close: tPlaces('close'), prev: tHome('prev'), next: tHome('next') }}
          rtl={rtl}
          returnFocus={opener}
        />
      )}
    </>
  );
}
