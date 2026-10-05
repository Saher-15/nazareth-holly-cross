import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import { NO_INDEX } from '@/data/pilgrim/seo';
import type { Translate } from '@/data/pilgrim/faqEntries';
import { buildSearchIndex } from '@/data/pilgrim/searchIndex';
import { searchEntries, snippet, type SearchType } from '@/lib/search';
import PageHero from '@/components/ui/PageHero';
import shared from '@/components/pilgrim/shared.module.css';
import styles from './page.module.css';

const TYPES: readonly SearchType[] = ['page', 'site', 'faq', 'gospel'];

export async function generateMetadata({ params }: PageProps<'/[locale]/search'>): Promise<Metadata> {
  const { locale } = await params;
  const base = await pilgrimMetadata(locale, 'search', '/search');
  return { ...base, ...NO_INDEX };
}

// /search: the same search as the Ctrl/Cmd + K palette, as a page that works without JavaScript (a plain GET form,
// results rendered on the server from the language's index). Search engines are told not to index it.
export default async function SearchPage({ params, searchParams }: PageProps<'/[locale]/search'>) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();

  const raw = Array.isArray(query.q) ? query.q[0] : query.q;
  const q = (raw ?? '').slice(0, 100).trim();
  const results = q ? searchEntries(buildSearchIndex(t as Translate, locale), q, 30) : [];

  return (
    <div className="ui-page">
      <PageHero
        eyebrow={t('pilgrim.search.page.eyebrow')}
        title={t('pilgrim.search.page.title')}
        lead={t('pilgrim.search.page.lead')}
        image="/images/vitrage-bg.jpg"
      />

      <section className="ui-section">
        <div className={`ui-container ${styles.wrap}`}>
          <form action={`/${locale}/search`} method="get" role="search" className={styles.form}>
            <label className="visually-hidden" htmlFor="site-search-q">
              {t('pilgrim.search.label')}
            </label>
            <input
              id="site-search-q"
              name="q"
              type="search"
              className="ui-input"
              placeholder={t('pilgrim.search.placeholder')}
              defaultValue={q}
              maxLength={100}
              autoComplete="off"
            />
            <button type="submit" className="ui-btn ui-btn--gold">
              {t('pilgrim.search.submit')}
            </button>
          </form>

          {q && (
            <p className={styles.count} role="status">
              {results.length ? t('pilgrim.search.count', { count: results.length }) : t('pilgrim.search.none', { query: q })}
            </p>
          )}

          {TYPES.map((type) => {
            const items = results.filter((r) => r.type === type);
            if (!items.length) return null;
            return (
              <section key={type} aria-labelledby={`results-${type}`}>
                <h2 id={`results-${type}`} className={styles.heading}>
                  {t(`pilgrim.search.types.${type}`)}
                </h2>
                <ul className={styles.list}>
                  {items.map((entry) => (
                    <li key={entry.id} className={`ui-glass ${styles.item}`}>
                      <Link href={entry.href} className={styles.link}>
                        <span className={styles.title}>{entry.title}</span>
                        {entry.text && <span className={styles.snippet}>{snippet(entry.text, q, 180)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {!q && (
            <ul className={shared.toc}>
              {(['plan', 'visit', 'gospel', 'gallery', 'prayers', 'faq'] as const).map((key) => (
                <li key={key}>
                  <Link href={`/${key}`}>{t(`pilgrim.nav.${key}`)}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
