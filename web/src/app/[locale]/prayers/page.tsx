import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { breadcrumbJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import {
  categoryKey,
  displayText,
  isCategory,
  PRAYER_CATEGORIES,
  PRAYERS_PER_PAGE,
} from '@/data/pilgrim/prayers';
import { api, type Prayer } from '@/lib/api';
import JsonLd from '@/components/ui/JsonLd';
import PlaceHero from '@/components/places/PlaceHero';
import LikeButton from '@/components/pilgrim/LikeButton';
import NextSteps from '@/components/pilgrim/NextSteps';
import PrayerForm from '@/components/pilgrim/PrayerForm';
import Reveal from '@/components/ui/Reveal';
import styles from './page.module.css';

const HERO = { src: '/images/candle.jpg', width: 1600, height: 1067 };

export async function generateMetadata({ params }: PageProps<'/[locale]/prayers'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'prayers', '/prayers', HERO);
}

/** One page of the wall; null when the API cannot be reached (the page then says so). */
async function loadPrayers(page: number, category?: string): Promise<{ prayers: Prayer[]; total: number } | null> {
  try {
    return await api.prayers(page, PRAYERS_PER_PAGE, category);
  } catch (error) {
    console.error('[prayers] could not load the prayer wall:', error);
    return null;
  }
}

const href = (category: string | undefined, page: number) => {
  const query = new URLSearchParams();
  if (category) query.set('category', category);
  if (page > 1) query.set('page', String(page));
  const text = query.toString();
  return `/prayers${text ? `?${text}` : ''}#wall`;
};

// /prayers: the prayer wall. The list is read from the API on the server (a category and a page number live in
// the URL, so it works without JavaScript); the form and the Amen button are small client components.
export default async function PrayersPage({ params, searchParams }: PageProps<'/[locale]/prayers'>) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const rawCategory = Array.isArray(query.category) ? query.category[0] : query.category;
  const category = isCategory(rawCategory) ? rawCategory : undefined;
  const rawPage = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 10_000 ? rawPage : 1;

  const [t, format, data] = await Promise.all([getTranslations(), getFormatter(), loadPrayers(page, category)]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PRAYERS_PER_PAGE)) : 1;

  const jsonLd = [
    webPageJsonLd(locale, {
      type: 'CollectionPage',
      path: '/prayers',
      name: t('pilgrim.prayers.meta.title'),
      description: t('pilgrim.prayers.meta.description'),
    }),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('pilgrim.nav.prayers'), path: '/prayers' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={HERO}
        size="medium"
        eyebrow={t('pilgrim.prayers.hero.eyebrow')}
        title={t('pilgrim.prayers.hero.title')}
        lead={t('pilgrim.prayers.hero.lead')}
      >
        <a href="#share" className="ui-btn ui-btn--gold">
          {t('pilgrim.prayers.hero.cta')}
        </a>
        <Link href="/candle" className="ui-btn ui-btn--glass">
          {t('home.stickyCandle')}
        </Link>
      </PlaceHero>

      <section className="ui-section">
        <div className={`ui-container ${styles.layout}`}>
          <div className={styles.aside} id="share">
            <Reveal>
              <PrayerForm titleId="prayer-form-title" />
            </Reveal>
          </div>

          <div className={styles.wall} id="wall">
            <h2 className="ui-h2">{t('pilgrim.prayers.wall.title')}</h2>
            <nav aria-label={t('pilgrim.prayers.wall.filter')}>
              <ul className={styles.filters}>
                <li>
                  <Link href={href(undefined, 1)} className={styles.filter} aria-current={category ? undefined : 'true'}>
                    {t('pilgrim.prayers.categories.all')}
                  </Link>
                </li>
                {PRAYER_CATEGORIES.map((c) => (
                  <li key={c}>
                    <Link href={href(c, 1)} className={styles.filter} aria-current={category === c ? 'true' : undefined}>
                      {t(`pilgrim.prayers.categories.${categoryKey(c)}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {data === null ? (
              <div className={`ui-glass ui-card ${styles.state}`} role="status">
                <h3 className="ui-h3">{t('pilgrim.prayers.wall.errorTitle')}</h3>
                <p>{t('pilgrim.prayers.wall.errorText')}</p>
                <Link href={href(category, page)} className="ui-btn ui-btn--glass">
                  {t('pilgrim.prayers.wall.retry')}
                </Link>
              </div>
            ) : data.prayers.length === 0 ? (
              <div className={`ui-glass ui-card ${styles.state}`}>
                <h3 className="ui-h3">{t('pilgrim.prayers.wall.emptyTitle')}</h3>
                <p>{t('pilgrim.prayers.wall.emptyText')}</p>
                <a href="#share" className="ui-btn ui-btn--gold">
                  {t('pilgrim.prayers.hero.cta')}
                </a>
              </div>
            ) : (
              <>
                <p className={styles.count}>{t('pilgrim.prayers.wall.count', { count: data.total })}</p>
                <ul className={styles.list}>
                  {data.prayers.map((prayer) => {
                    const name = displayText(prayer.name, 100) || t('pilgrim.prayers.wall.anonymous');
                    return (
                      <li key={prayer._id} className={`ui-glass ${styles.prayer}`}>
                        <header className={styles.meta}>
                          <p className={styles.who}>
                            <span dir="auto">{name}</span>
                            {prayer.country && (
                              <span className={styles.country} dir="auto">
                                {displayText(prayer.country, 100)}
                              </span>
                            )}
                          </p>
                          <span className={styles.tag}>
                            {isCategory(prayer.category)
                              ? t(`pilgrim.prayers.categories.${categoryKey(prayer.category)}`)
                              : t('pilgrim.prayers.categories.personal')}
                          </span>
                        </header>
                        <p className={styles.text} dir="auto">
                          {displayText(prayer.prayer)}
                        </p>
                        <footer className={styles.foot}>
                          <LikeButton id={prayer._id} likes={prayer.likes} name={name} />
                          {prayer.createdAt && !Number.isNaN(Date.parse(prayer.createdAt)) && (
                            <time className={styles.date} dateTime={prayer.createdAt}>
                              {format.dateTime(new Date(prayer.createdAt), { dateStyle: 'medium' })}
                            </time>
                          )}
                        </footer>
                      </li>
                    );
                  })}
                </ul>

                {pages > 1 && (
                  <nav className={styles.pager} aria-label={t('pilgrim.prayers.wall.pages')}>
                    {page > 1 ? (
                      <Link href={href(category, page - 1)} className="ui-btn ui-btn--glass" rel="prev">
                        {t('pilgrim.prayers.wall.prev')}
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className={styles.pageOf}>{t('pilgrim.prayers.wall.pageOf', { page, pages })}</span>
                    {page < pages ? (
                      <Link href={href(category, page + 1)} className="ui-btn ui-btn--glass" rel="next">
                        {t('pilgrim.prayers.wall.next')}
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <NextSteps pages={['gospel', 'plan', 'gallery']} />
    </div>
  );
}
