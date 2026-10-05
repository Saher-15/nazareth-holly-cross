import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { directionsUrl, type Place } from '@/data/places/places';
import ExternalLink from './ExternalLink';
import { PinIcon, RouteIcon } from './icons';
import styles from './VisitCard.module.css';

// "Plan your visit" card next to the story (sticky on wide screens): map, directions, candle.
export default async function VisitCard({ place }: { place: Place }) {
  const t = await getTranslations();

  return (
    <aside className={`ui-glass ui-card ${styles.card}`} aria-labelledby="place-visit-title">
      <h2 id="place-visit-title" className="ui-eyebrow">
        {t('placesPage.visitEyebrow')}
      </h2>
      <p className={styles.text}>{t('placesPage.visitText')}</p>
      <div className={styles.actions}>
        <ExternalLink
          href={place.mapUrl}
          className="ui-btn ui-btn--ghost"
          icon={<PinIcon size={18} />}
          newTabLabel={t('placesPage.newTab')}
        >
          {t('headerGreek.mapButton')}
        </ExternalLink>
        <ExternalLink
          href={directionsUrl(place.geo)}
          className="ui-btn ui-btn--ghost"
          icon={<RouteIcon size={18} />}
          newTabLabel={t('placesPage.newTab')}
        >
          {t('placesPage.directions')}
        </ExternalLink>
        <Link className="ui-btn ui-btn--gold" href="/candle">
          <span className={styles.flame} aria-hidden="true" />
          {t('home.stickyCandle')}
        </Link>
      </div>
    </aside>
  );
}
