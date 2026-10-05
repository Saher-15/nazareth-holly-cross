import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHero from '@/components/ui/PageHero';
import { flowMetadata } from '@/components/checkout/metadata';
import shared from '@/components/checkout/checkout.module.css';
import CandleFlow from './CandleFlow';
import styles from './candle.module.css';

export async function generateMetadata({ params }: PageProps<'/[locale]/candle'>): Promise<Metadata> {
  const { locale } = await params;
  return flowMetadata(locale, 'candle');
}

const STEPS = ['step1', 'step2', 'step3'] as const;

// Light a prayer candle: how it works (static) next to the form + payment (CandleFlow).
export default async function CandlePage({ params }: PageProps<'/[locale]/candle'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className={`ui-page ${shared.page} ${styles.page}`}>
      <PageHero
        eyebrow={t('checkoutPage.hero.candleEyebrow')}
        title={t('home.candleTitle')}
        lead={t('home.candleText')}
        image="/images/candle.jpg"
      />

      <div className={`ui-container ${styles.layout}`}>
        <aside className={styles.guide} aria-labelledby="candle-howto">
          <div className={styles.visual} aria-hidden="true">
            <span className={styles.halo} />
            <span className={`${shared.flame} ${shared.flameLg} ${styles.visualFlame}`} />
            <span className={styles.wick} />
            <span className={styles.wax} />
            <span className={styles.plate} />
          </div>
          <h2 id="candle-howto" className={`ui-h2 ${styles.howto}`}>
            {t('candle.howToLightACandle')}
          </h2>
          <p className={styles.simple}>{t('candle.itsSimple')}</p>
          <ol className={styles.steps}>
            {STEPS.map((key, i) => (
              <li key={key}>
                <span className={styles.stepN} aria-hidden="true">
                  {i + 1}
                </span>
                <p>{t(`candle.${key}`)}</p>
              </li>
            ))}
          </ol>
        </aside>

        <CandleFlow />
      </div>
    </div>
  );
}
