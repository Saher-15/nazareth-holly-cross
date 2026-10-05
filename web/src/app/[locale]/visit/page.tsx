import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { photo } from '@/data/places/places';
import { breadcrumbJsonLd } from '@/data/places/seo';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import { faqJsonLd, webPageJsonLd } from '@/data/pilgrim/seo';
import { faqItems, type Translate } from '@/data/pilgrim/faqEntries';
import { FAQ_GROUPS } from '@/data/pilgrim/faq';
import { celsiusToFahrenheit, CLIMATE, ROUTES } from '@/data/pilgrim/visit';
import JsonLd from '@/components/places/JsonLd';
import PlaceHero from '@/components/places/PlaceHero';
import FaqList from '@/components/pilgrim/FaqList';
import NextSteps from '@/components/pilgrim/NextSteps';
import shared from '@/components/pilgrim/shared.module.css';
import Reveal from '@/components/ui/Reveal';
import styles from './page.module.css';

const HERO = photo('nazareth', 9);

const ESSENTIALS = ['dress', 'etiquette', 'seasons', 'safety', 'money', 'language'] as const;

export async function generateMetadata({ params }: PageProps<'/[locale]/visit'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'visit', '/visit', HERO);
}

// /visit: the practical guide: how to get there, what to wear, when to come, safety, money, the weather by
// month and the questions visitors ask most (also published as FAQPage structured data).
export default async function VisitPage({ params }: PageProps<'/[locale]/visit'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const number = (n: number) => format.number(n);

  const faq = faqItems(t as Translate, locale, FAQ_GROUPS.filter((g) => g.id === 'visiting'));
  const jsonLd = [
    webPageJsonLd(locale, {
      path: '/visit',
      name: t('pilgrim.visit.meta.title'),
      description: t('pilgrim.visit.meta.description'),
    }),
    faqJsonLd(faq.map((f) => ({ question: f.question, answer: f.answer }))),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('pilgrim.nav.visit'), path: '/visit' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={HERO}
        size="medium"
        eyebrow={t('pilgrim.visit.hero.eyebrow')}
        title={t('pilgrim.visit.hero.title')}
        lead={t('pilgrim.visit.hero.lead')}
      />

      <section className="ui-section" aria-labelledby="getting-title">
        <div className="ui-container">
          <Reveal as="header" className={shared.head}>
            <p className="ui-eyebrow">{t('pilgrim.visit.getting.eyebrow')}</p>
            <h2 id="getting-title" className="ui-h2">
              {t('pilgrim.visit.getting.title')}
            </h2>
            <p className={shared.lead}>{t('pilgrim.visit.getting.lead')}</p>
          </Reveal>
          <ul className={shared.cards}>
            {ROUTES.map((route, i) => (
              <Reveal as="li" key={route.id} className={`ui-glass ui-card ${shared.card}`} delay={i * 80}>
                <h3 className="ui-h3">{t(`pilgrim.visit.getting.routes.${route.id}.title`)}</h3>
                <p className={styles.distance}>{t('pilgrim.visit.getting.distance', { km: number(route.km) })}</p>
                <p>{t(`pilgrim.visit.getting.routes.${route.id}.text`)}</p>
              </Reveal>
            ))}
            <Reveal as="li" className={`ui-glass ui-card ${shared.card}`} delay={240}>
              <h3 className="ui-h3">{t('pilgrim.visit.getting.local.title')}</h3>
              <p>{t('pilgrim.visit.getting.local.text')}</p>
            </Reveal>
          </ul>
        </div>
      </section>

      <section className="ui-section" aria-labelledby="essentials-title">
        <div className="ui-container">
          <Reveal as="header" className={shared.head}>
            <p className="ui-eyebrow">{t('pilgrim.visit.essentials.eyebrow')}</p>
            <h2 id="essentials-title" className="ui-h2">
              {t('pilgrim.visit.essentials.title')}
            </h2>
          </Reveal>
          <ul className={shared.cards}>
            {ESSENTIALS.map((key, i) => (
              <Reveal as="li" key={key} className={`ui-glass ui-card ${shared.card}`} delay={(i % 3) * 80}>
                <h3 className="ui-h3">{t(`pilgrim.visit.essentials.items.${key}.title`)}</h3>
                <p>{t(`pilgrim.visit.essentials.items.${key}.text`)}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="ui-section" aria-labelledby="climate-title">
        <div className="ui-container">
          <Reveal as="header" className={shared.head}>
            <p className="ui-eyebrow">{t('pilgrim.visit.climate.eyebrow')}</p>
            <h2 id="climate-title" className="ui-h2">
              {t('pilgrim.visit.climate.title')}
            </h2>
            <p className={shared.lead}>{t('pilgrim.visit.climate.lead')}</p>
          </Reveal>
          <div className={shared.tableWrap} tabIndex={0} role="region" aria-label={t('pilgrim.visit.climate.title')}>
            <table className={`${shared.table} ${styles.climate}`}>
              <caption>{t('pilgrim.visit.climate.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('pilgrim.visit.climate.month')}</th>
                  <th scope="col">{t('pilgrim.visit.climate.high')}</th>
                  <th scope="col">{t('pilgrim.visit.climate.low')}</th>
                  <th scope="col">{t('pilgrim.visit.climate.rain')}</th>
                  <th scope="col">{t('pilgrim.visit.climate.season')}</th>
                </tr>
              </thead>
              <tbody>
                {CLIMATE.map((month, i) => (
                  <tr key={i}>
                    <th scope="row">{format.dateTime(new Date(Date.UTC(2001, i, 15)), { month: 'long', timeZone: 'UTC' })}</th>
                    <td>
                      <span className={styles.temp}>
                        <span className={styles.bar} style={{ inlineSize: `${(month.high / 35) * 100}%` }} aria-hidden="true" />
                        <span>
                          {number(month.high)}° <span className={styles.f}>({number(celsiusToFahrenheit(month.high))}°F)</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      {number(month.low)}° <span className={styles.f}>({number(celsiusToFahrenheit(month.low))}°F)</span>
                    </td>
                    <td>{t('pilgrim.visit.climate.mm', { mm: number(month.rain) })}</td>
                    <td>
                      <span className={`${styles.season} ${styles[month.season]}`}>
                        {t(`pilgrim.visit.climate.seasons.${month.season}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>{t('pilgrim.visit.climate.note')}</p>
        </div>
      </section>

      <section className="ui-section" aria-labelledby="visit-faq-title">
        <div className="ui-container">
          <Reveal as="header" className={shared.head}>
            <p className="ui-eyebrow">{t('pilgrim.faq.eyebrow')}</p>
            <h2 id="visit-faq-title" className="ui-h2">
              {t('pilgrim.visit.faq.title')}
            </h2>
          </Reveal>
          <FaqList items={faq} idPrefix="visit-" />
        </div>
      </section>

      <NextSteps pages={['plan', 'gospel', 'contact']} />
    </div>
  );
}
