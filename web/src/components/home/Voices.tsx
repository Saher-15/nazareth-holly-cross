import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Reveal from '@/components/ui/Reveal';
import type { Review } from '@/lib/api';
import { reviewerPlace } from '@/lib/reviews';
import { dateLocale, NAZARETH_TIME_ZONE } from '@/lib/time';
import { clip, loadVoices } from './data';
import styles from './Voices.module.css';

type ViewProps = { id: string; reviews: Review[] };

// Words from visitors, newest first, with the month they wrote (Nazareth time), rendered on the server. Hidden
// entirely when there are no reviews or the reviews cannot be loaded.
export function VoicesView({ id, reviews }: ViewProps) {
  const t = useTranslations('home');
  const locale = useLocale();
  if (reviews.length === 0) return null;
  const date = new Intl.DateTimeFormat(dateLocale(locale), { month: 'long', year: 'numeric', timeZone: NAZARETH_TIME_ZONE, numberingSystem: 'latn' });

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <Reveal className="ui-container">
        <header className={styles.head}>
          <p className="ui-eyebrow">{t('voicesEyebrow')}</p>
          <h2 id={`${id}-title`} className="ui-h2">
            {t('voicesTitle')}
          </h2>
        </header>
        {/* Scrolls sideways on small screens, so it is focusable for keyboard users. */}
        <div className={styles.scroller} role="group" aria-labelledby={`${id}-title`} tabIndex={0}>
          <ul className={styles.strip}>
            {reviews.map((review) => {
              const place = reviewerPlace(review, locale);
              const when = review.createdAt && !Number.isNaN(Date.parse(review.createdAt)) ? review.createdAt : null;
              return (
                <li key={review._id} className={`ui-glass ${styles.voice}`}>
                  <blockquote className={styles.quote}>
                    <p dir="auto">{clip(review.msg)}</p>
                  </blockquote>
                  <p className={styles.by}>
                    <bdi>{review.fullName}</bdi>
                    {place && (
                      <span className={styles.place}>
                        {' · '}
                        <bdi>{place}</bdi>
                      </span>
                    )}
                    {when && (
                      <time className={styles.when} dateTime={when}>
                        {date.format(new Date(when))}
                      </time>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
        <p className={styles.center}>
          <Link href="/reviews" className="ui-btn ui-btn--ghost">
            {t('voicesAll')}
          </Link>
        </p>
      </Reveal>
    </section>
  );
}

export default async function Voices({ id }: { id: string }) {
  const reviews = await loadVoices();
  return <VoicesView id={id} reviews={reviews} />;
}
