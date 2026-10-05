import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import PageHero from '@/components/ui/PageHero';

// Starter home page of the new platform. The full immersive home (candle strip,
// holy-sites carousel, verse of the day, souvenirs, voices) is ported next.
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <div className="ui-page">
      <PageHero eyebrow={t('eyebrow')} title={t('title')} lead={t('subtitle')} image="/images/nazareth/nazareth1.webp">
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
          <Link href="/candle" className="ui-btn ui-btn--gold">
            {t('stickyCandle')}
          </Link>
          <Link href="/shop" className="ui-btn ui-btn--glass">
            {t('shopAll')}
          </Link>
        </div>
      </PageHero>
    </div>
  );
}
