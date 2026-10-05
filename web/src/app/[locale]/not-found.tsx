import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowEndIcon, FlameIcon, PinIcon, RouteIcon } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { photo } from '@/data/places/places';
import styles from './not-found.module.css';

const HERO = photo('latin', 1);

// Where a lost visitor most likely wants to go next: the three main reasons people come.
const SUGGESTIONS = [
  { href: '/sites', key: 'sites', icon: PinIcon },
  { href: '/tour', key: 'tour', icon: RouteIcon },
  { href: '/candle', key: 'candle', icon: FlameIcon },
] as const;

export default function NotFound() {
  const t = useTranslations('site');
  const tx = useTranslations('ux.notFound');

  return (
    <div className={`ui-page ${styles.page}`}>
      <section className={styles.hero} aria-labelledby="not-found-title">
        <Image className={styles.bg} src={HERO.src} alt="" fill sizes="100vw" priority />
        <div className={`ui-container ${styles.inner}`}>
          {/* The number is a picture of "404", not text to read aloud. */}
          <p className={styles.code} dir="ltr" aria-hidden="true">
            404
          </p>
          <h1 id="not-found-title" className={styles.title}>
            {t('notFound.title')}
          </h1>
          <p className={styles.text}>{t('notFound.text')}</p>
          <div className={styles.actions}>
            <Link href="/" className="ui-btn ui-btn--gold">
              {t('notFound.backHome')}
            </Link>
          </div>
        </div>
      </section>

      <section className={`ui-container ${styles.suggest}`} aria-labelledby="not-found-suggest">
        <h2 id="not-found-suggest" className="ui-eyebrow">
          {tx('suggestions')}
        </h2>
        <ul className={styles.cards}>
          {SUGGESTIONS.map(({ href, key, icon: Icon }) => (
            <li key={key}>
              <Link href={href} className={`ui-glass ui-card--interactive ${styles.card}`}>
                <span className={styles.cardIcon}>
                  <Icon size={22} />
                </span>
                <span className={styles.cardText}>
                  <span className={styles.cardTitle}>{t(`nav.${key}`)}</span>
                  <span className={styles.cardHint}>{tx(`hint.${key}`)}</span>
                </span>
                <ArrowEndIcon size={18} flip className={styles.cardArrow} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
