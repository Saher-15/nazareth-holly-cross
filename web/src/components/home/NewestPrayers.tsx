import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Reveal from '@/components/ui/Reveal';
import { categoryKey, displayText, isCategory, wallCountry } from '@/data/pilgrim/prayers';
import { dateLocale, NAZARETH_TIME_ZONE } from '@/lib/time';
import { clip, loadPrayerWall, type PrayerWall } from './data';
import styles from './NewestPrayers.module.css';

type ViewProps = { id: string; wall: PrayerWall | null };

// The prayer wall on the home page: how many prayers it holds and from how many countries (real figures from the API,
// nothing estimated), and the newest three. Rendered on the server; left out when the wall cannot be read.
export function NewestPrayersView({ id, wall }: ViewProps) {
  const t = useTranslations();
  const locale = useLocale();
  if (!wall) return null;
  const number = new Intl.NumberFormat(locale, { numberingSystem: 'latn' });
  const date = new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: 'medium', timeZone: NAZARETH_TIME_ZONE, numberingSystem: 'latn' });

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <Reveal className="ui-container">
        <header className={styles.head}>
          <p className="ui-eyebrow">{t('pilgrim.nav.prayers')}</p>
          <h2 id={`${id}-title`} className="ui-h2">
            {t('home.prayersTitle')}
          </h2>
        </header>

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>{t('home.prayersTotal')}</dt>
            <dd className={styles.figure} data-testid="prayers-total">
              {number.format(wall.total)}
            </dd>
          </div>
          {wall.countries > 0 && (
            <div className={styles.stat}>
              <dt>
                {wall.sample < wall.total
                  ? t('home.prayersCountriesLatest', { count: wall.sample })
                  : t('home.prayersCountriesAll')}
              </dt>
              <dd className={styles.figure} data-testid="prayers-countries">
                {number.format(wall.countries)}
              </dd>
            </div>
          )}
        </dl>

        <ul className={styles.list}>
          {wall.newest.map((prayer) => {
            const name = displayText(prayer.name, 100) || t('pilgrim.prayers.wall.anonymous');
            const when = prayer.createdAt && !Number.isNaN(Date.parse(prayer.createdAt)) ? prayer.createdAt : null;
            return (
              <li key={prayer._id} className={`ui-glass ${styles.prayer}`}>
                <span className={styles.tag}>
                  {t(`pilgrim.prayers.categories.${isCategory(prayer.category) ? categoryKey(prayer.category) : 'personal'}`)}
                </span>
                <blockquote className={styles.quote}>
                  <p dir="auto">{clip(displayText(prayer.prayer), 180)}</p>
                </blockquote>
                <p className={styles.by}>
                  <span dir="auto">{name}</span>
                  {prayer.country && (
                    <span className={styles.country} dir="auto">
                      {wallCountry(prayer.country, locale)}
                    </span>
                  )}
                  {when && (
                    <time className={styles.date} dateTime={when}>
                      {date.format(new Date(when))}
                    </time>
                  )}
                </p>
              </li>
            );
          })}
        </ul>

        <p className={styles.actions}>
          <Link href="/prayers" className="ui-btn ui-btn--ghost">
            {t('home.prayersAll')}
          </Link>
          <Link href="/prayers#share" className="ui-btn ui-btn--ghost">
            {t('pilgrim.prayers.hero.cta')}
          </Link>
        </p>
      </Reveal>
    </section>
  );
}

export default async function NewestPrayers({ id }: { id: string }) {
  const wall = await loadPrayerWall();
  return <NewestPrayersView id={id} wall={wall} />;
}
