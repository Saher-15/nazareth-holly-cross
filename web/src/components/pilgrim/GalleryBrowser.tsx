'use client';

import { useCallback, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowEndIcon } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { isRtl } from '@/i18n/routing';
import type { MediaTopic } from '@/data/media';
import { isPlaceSlug, type Photo, type PlaceSlug } from '@/data/places/places';
import PhotoImage from '@/components/places/PhotoImage';
import { ZoomIcon } from '@/components/places/icons';
import { replaceQueryString, useQueryString } from '@/lib/urlState';
import styles from './GalleryBrowser.module.css';

// The photo viewer is only needed after a click: its code is fetched then, not with the page.
const Lightbox = dynamic(() => import('@/components/places/Lightbox'));

/** The licensed photos of one topic (what they show), and the holy-site page that topic belongs to. */
export type GalleryGroup = {
  /** Media topic: names the section (`gallery-<topic>`) and the translated heading. */
  topic: MediaTopic;
  slug: PlaceSlug;
  /** Path of the holy-site page, without the language. */
  href: string;
  photos: readonly Photo[];
};
export type GalleryFilter = { slug: PlaceSlug; name: string; count: number };

const SIZES = '(min-width: 1100px) 290px, (min-width: 700px) 33vw, 50vw';

const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.closest('button')?.setAttribute('data-loaded', '');
};

// The gallery of Nazareth: every licensed photograph grouped by what it shows (each group a masonry grid),
// a filter by holy site (kept in the URL as ?site=latin, so a filtered view can be shared) and the same
// accessible lightbox the holy-site pages use, which names the photographer and the licence.
export default function GalleryBrowser({ groups, filters }: { groups: readonly GalleryGroup[]; filters: readonly GalleryFilter[] }) {
  const t = useTranslations('pilgrim.gallery');
  const tPlaces = useTranslations('placesPage');
  const tHome = useTranslations('home');
  const tMedia = useTranslations('media');
  const rtl = isRtl(useLocale());
  const search = useQueryString();
  const siteParam = new URLSearchParams(search).get('site') ?? '';
  const site = isPlaceSlug(siteParam) ? siteParam : null;

  const shown = useMemo(() => (site ? groups.filter((g) => g.slug === site) : groups), [groups, site]);
  // One flat list for the viewer: the photos of the visible groups, in order, each remembering its group.
  const flat = useMemo(
    () => shown.flatMap((g) => g.photos.map((photo, i) => ({ photo, topic: g.topic, n: i + 1, total: g.photos.length }))),
    [shown],
  );
  const photos = useMemo(() => flat.map((f) => f.photo), [flat]);
  const totalCount = useMemo(() => groups.reduce((sum, g) => sum + g.photos.length, 0), [groups]);

  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => setIndex(null), []);

  // Licensed photos describe themselves (topic and subject, translated); every alt ends in "photo n of N" so
  // the photos of a group are told apart.
  const altFor = useCallback(
    (photo: Photo, n: number, total: number) => {
      const media = photo.media;
      const place = media
        ? tMedia('alt', { topic: tMedia(`topic.${media.topic}`), subject: tMedia(`subject.${media.subject}`) })
        : '';
      return tPlaces('photoAlt', { place, n, total });
    },
    [tMedia, tPlaces],
  );
  const altOf = useCallback(
    (i: number) => {
      const item = flat[i];
      return item ? altFor(item.photo, item.n, item.total) : '';
    },
    [flat, altFor],
  );
  const creditOf = useCallback(
    (i: number) => {
      const media = flat[i]?.photo.media;
      return media
        ? {
            text: tMedia('creditLine', { author: media.author, license: media.license }),
            sourceUrl: media.sourceUrl,
            sourceLabel: tMedia('source'),
          }
        : null;
    },
    [flat, tMedia],
  );

  const choose = (next: PlaceSlug | null) => replaceQueryString(next ? `site=${next}` : '');

  // Where each visible group starts in the flat list the viewer walks through.
  const starts = shown.map((_, i) => shown.slice(0, i).reduce((sum, g) => sum + g.photos.length, 0));
  return (
    <>
      <div role="group" aria-label={t('filterLabel')} className={styles.filters}>
        <button type="button" className={styles.filter} aria-pressed={!site} onClick={() => choose(null)}>
          {t('all')} <span className={styles.badge}>{totalCount}</span>
        </button>
        {filters.map((f) => (
          <button key={f.slug} type="button" className={styles.filter} aria-pressed={site === f.slug} onClick={() => choose(f.slug)}>
            {f.name} <span className={styles.badge}>{f.count}</span>
          </button>
        ))}
      </div>
      <p className={styles.count} role="status">
        {tPlaces('photoCount', { count: flat.length })}
      </p>

      {shown.map((group, groupIndex) => {
        const start = starts[groupIndex];
        const title = tMedia(`topic.${group.topic}`);
        return (
          <section key={group.topic} id={`gallery-${group.topic}`} className={styles.group} aria-labelledby={`gallery-${group.topic}-title`}>
            <header className={styles.head}>
              <h2 id={`gallery-${group.topic}-title`} className={`ui-h3 ${styles.title}`}>
                {title}
              </h2>
              <Link href={group.href} className={styles.more}>
                {tMedia('gallery.visitPage')}
                <ArrowEndIcon size={16} flip />
              </Link>
            </header>
            <ul className={styles.masonry}>
              {group.photos.map((photo, i) => {
                const flatIndex = start + i;
                return (
                  <li key={photo.src} className={styles.cell}>
                    <button
                      type="button"
                      className={styles.thumb}
                      aria-haspopup="dialog"
                      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                      onClick={(e) => {
                        opener.current = e.currentTarget;
                        setIndex(flatIndex);
                      }}
                    >
                      <PhotoImage
                        photo={photo}
                        alt={altFor(photo, i + 1, group.photos.length)}
                        sizes={SIZES}
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
          </section>
        );
      })}

      {index !== null && flat[index] && (
        <Lightbox
          photos={photos}
          index={index}
          onIndexChange={setIndex}
          onClose={close}
          title={tMedia(`topic.${flat[index].topic}`)}
          label={t('viewer')}
          altOf={altOf}
          creditOf={creditOf}
          labels={{ close: tPlaces('close'), prev: tHome('prev'), next: tHome('next') }}
          rtl={rtl}
          returnFocus={opener}
        />
      )}
    </>
  );
}
