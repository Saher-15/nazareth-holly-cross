import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { api } from '@/lib/api';
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { FAQ_GROUPS } from '@/data/pilgrim/faq';
import { faqItems, type Translate } from '@/data/pilgrim/faqEntries';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import JsonLd from '@/components/ui/JsonLd';
import FaqList from '@/components/pilgrim/FaqList';
import NextSteps from '@/components/pilgrim/NextSteps';
import shared from '@/components/pilgrim/shared.module.css';
import PageHero from '@/components/ui/PageHero';
import { getMedia } from '@/data/media';

export async function generateMetadata({ params }: PageProps<'/[locale]/faq'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'faq', '/faq');
}

// /faq: every question, in four groups (visiting, candles and prayers, shop and payments, the site), with
// FAQPage structured data. Answers quote the shop's real figures (shipping, discount, candle price).
export default async function FaqPage({ params }: PageProps<'/[locale]/faq'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const translate = t as Translate;

  const candlePrice = await api.candlePrice();
  const groups = FAQ_GROUPS.map((group) => ({ group, items: faqItems(translate, locale, [group], candlePrice) }));
  const all = groups.flatMap((g) => g.items);

  const jsonLd = [
    webPageJsonLd(locale, {
      path: '/faq',
      name: t('pilgrim.faq.meta.title'),
      description: t('pilgrim.faq.meta.description'),
    }),
    faqJsonLd(all.map((f) => ({ question: f.question, answer: f.answer }))),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('pilgrim.nav.faq'), path: '/faq' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PageHero
        eyebrow={t('pilgrim.faq.eyebrow')}
        title={t('pilgrim.faq.title')}
        lead={t('pilgrim.faq.lead')}
        media={getMedia('basilica-night-front')}
      />

      <section className="ui-section">
        <div className="ui-container">
          <nav aria-label={t('pilgrim.faq.groupsLabel')}>
            <ul className={shared.toc}>
              {groups.map(({ group }) => (
                <li key={group.id}>
                  <a href={`#group-${group.id}`}>{t(`pilgrim.faq.groups.${group.id}`)}</a>
                </li>
              ))}
            </ul>
          </nav>
          {groups.map(({ group, items }) => (
            <section key={group.id} aria-labelledby={`group-${group.id}`} style={{ marginTop: 32 }}>
              <h2 id={`group-${group.id}`} className="ui-h2" style={{ textAlign: 'center', scrollMarginTop: 90 }}>
                {t(`pilgrim.faq.groups.${group.id}`)}
              </h2>
              <FaqList items={items} />
            </section>
          ))}
        </div>
      </section>

      <NextSteps pages={['contact', 'plan', 'visit']} />
    </div>
  );
}
