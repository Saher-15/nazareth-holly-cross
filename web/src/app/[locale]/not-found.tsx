import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import PageHero from '@/components/ui/PageHero';

export default function NotFound() {
  const t = useTranslations('site.notFound');
  return (
    <div className="ui-page">
      <PageHero eyebrow="404" title={t('title')} lead={t('text')}>
        <p style={{ marginTop: 28 }}>
          <Link href="/" className="ui-btn ui-btn--gold">
            {t('backHome')}
          </Link>
        </p>
      </PageHero>
    </div>
  );
}
