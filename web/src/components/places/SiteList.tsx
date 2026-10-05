import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { placeHref, type Place } from '@/data/places/places';
import Reveal from '@/components/ui/Reveal';
import ExternalLink from './ExternalLink';
import { ArrowIcon, PhotosIcon, PinIcon } from './icons';
import PhotoImage from './PhotoImage';
import styles from './SiteList.module.css';

// The holy sites index: one large editorial card per place, photo and text alternating sides.
// The whole card is one link (the place name); the map link sits above it as a second target.
export default async function SiteList({ places }: { places: readonly Place[] }) {
  const t = await getTranslations();

  return (
    <ol className={styles.list}>
      {places.map((place, i) => (
        <Reveal as="li" key={place.slug} className={styles.item}>
          <article className={styles.card} aria-labelledby={`site-${place.slug}`}>
            <div className={styles.media}>
              <PhotoImage photo={place.hero} alt="" sizes="(min-width: 900px) 640px, 100vw" />
              <span className={styles.badge}>
                <PhotosIcon size={16} />
                {t('placesPage.photoCount', { count: place.photos.length })}
              </span>
            </div>
            <div className={styles.body}>
              <span className={styles.number} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="ui-eyebrow">{t(`placesPage.kind.${place.slug}`)}</p>
              <h2 id={`site-${place.slug}`} className={styles.name}>
                <Link href={placeHref(place.slug)} className={styles.link}>
                  {t(place.nameKey)}
                </Link>
              </h2>
              <p className={styles.teaser}>{t(`placesPage.teaser.${place.slug}`)}</p>
              <div className={styles.footer}>
                <span className={styles.cta} aria-hidden="true">
                  {t('home.explore')} <ArrowIcon size={16} className={styles.arrow} />
                </span>
                <ExternalLink
                  href={place.mapUrl}
                  className={styles.map}
                  icon={<PinIcon size={16} />}
                  newTabLabel={t('placesPage.newTab')}
                >
                  {t('headerGreek.mapButton')}
                </ExternalLink>
              </div>
            </div>
          </article>
        </Reveal>
      ))}
    </ol>
  );
}
