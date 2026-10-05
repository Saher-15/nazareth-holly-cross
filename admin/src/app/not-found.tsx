import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { getI18n } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main id="main" className="center-page" tabIndex={-1}>
      <div className="state">
        <Icon name="search" size={32} />
        <h1 className="state__title">{t('state.notFound')}</h1>
        <p className="state__text">{t('state.notFoundText')}</p>
        <Link className="btn btn--gold btn--sm" href="/">{t('nav.dashboard')}</Link>
      </div>
    </main>
  );
}
