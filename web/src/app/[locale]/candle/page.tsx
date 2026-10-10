import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { api } from '@/lib/api';
import { formatUsd } from '@/lib/pricing';
import { Link } from '@/i18n/navigation';
import PageHero from '@/components/ui/PageHero';
import { TrackedLink, TrackView } from '@/components/analytics/Track';
import { CheckIcon } from '@/components/ui/icons';
import { getMedia } from '@/data/media';
import { flowMetadata } from '@/components/checkout/metadata';
import shared from '@/components/checkout/checkout.module.css';
import CandleFlow from './CandleFlow';
import CandleVideos from './CandleVideos';
import styles from './candle.module.css';

export async function generateMetadata({ params }: PageProps<'/[locale]/candle'>): Promise<Metadata> {
  const { locale } = await params;
  return flowMetadata(locale, 'candle');
}

/** Where the hero's button and campaign links land: the form (CandleFlow). */
const FORM_ID = 'candle-form';
const POINTS = ['pReal', 'pVideo', 'pGuest', 'pSecure'] as const;
const STEPS = ['s1', 's2', 's3'] as const;
const QUESTIONS = ['real', 'get', 'time', 'who', 'wrong'] as const;

// Light a prayer candle: the page that sells the service (owner's brief, 2026-10-10; docs/DESIGN-GUIDE.md "Candle").
// First screen, on a phone too: what it is (a REAL candle in the church the customer chooses, filmed, the personal
// video within 48 hours), and one button with the price. Then the films (when the owner has uploaded any), the three
// steps, the form with the payment, and the plain answers that make a stranger trust it. The same promises are in
// the FAQ and the terms (messages pilgrim.faq / pilgrim.legal.terms): change them together.
export default async function CandlePage({ params }: PageProps<'/[locale]/candle'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [priceUsd, videos] = await Promise.all([api.candlePrice(), api.candleVideos()]);
  const price = formatUsd(priceUsd, locale);

  return (
    <div className={`ui-page ${shared.page} ${styles.page}`}>
      <PageHero eyebrow={t('candlePage.eyebrow')} title={t('candlePage.title')} lead={t('candlePage.lead')} media={getMedia('basilica-grotto-altar')}>
        <p className="ui-hero__action">
          {/* A plain link to the form on this page: it works before the scripts load. */}
          <TrackedLink flow="candle" event="cta" href={`#${FORM_ID}`} className={`ui-btn ui-btn--gold ${shared.btnLg}`} data-testid="candle-cta">
            {t('candlePage.cta', { price })}
          </TrackedLink>
        </p>
        <ul className={styles.points}>
          {POINTS.map((key) => (
            <li key={key}>
              <CheckIcon size={16} />
              {t(`candlePage.${key}`)}
            </li>
          ))}
        </ul>
      </PageHero>

      {/* Counts one opening of the page for the sales funnel: anonymous, no cookie (docs/ANALYTICS.md) */}
      <TrackView flow="candle" />

      <CandleVideos videos={videos} />

      <section className={`ui-container ${styles.how}`} aria-labelledby="candle-howto">
        <h2 id="candle-howto" className={`ui-h2 ${styles.howTitle}`}>
          {t('candlePage.stepsTitle')}
        </h2>
        <ol className={styles.steps}>
          {STEPS.map((key, i) => (
            <li key={key}>
              <span className={styles.stepN} aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className={styles.stepTitle}>{t(`candlePage.${key}T`, { price })}</h3>
                <p>{t(`candlePage.${key}X`, { latin: t('home.siteLatin'), greek: t('home.siteGreek') })}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className={`ui-container ${styles.layout}`}>
        <div id={FORM_ID} className={styles.formAnchor}>
          <CandleFlow priceUsd={priceUsd} />
        </div>

        <aside className={`ui-glass ${styles.know}`} aria-labelledby="candle-know">
          <h2 id="candle-know" className={styles.knowTitle}>
            {t('candlePage.knowTitle')}
          </h2>
          <dl className={styles.answers}>
            {QUESTIONS.map((key) => (
              <div key={key}>
                <dt>{t(`candlePage.${key}Q`)}</dt>
                <dd>{t(`candlePage.${key}A`)}</dd>
              </div>
            ))}
          </dl>
          <Link href="/contact" className="ui-btn ui-btn--ghost">
            {t('candlePage.contact')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
