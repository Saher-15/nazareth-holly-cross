import { getI18n } from '@/i18n/server';

export default async function Loading() {
  const { t } = await getI18n();
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="loading">
      <span className="visually-hidden">{t('state.loading')}</span>
      <div className="skeleton skeleton--title" />
      <div className="skeleton-row">
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
      </div>
      <div className="skeleton skeleton--table" />
    </div>
  );
}
