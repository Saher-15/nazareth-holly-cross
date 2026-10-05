import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { mediaPhoto } from '@/data/places/places';
import { breadcrumbJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import JsonLd from '@/components/ui/JsonLd';
import PlaceHero from '@/components/places/PlaceHero';
import NextSteps from '@/components/pilgrim/NextSteps';
import Planner from '@/components/pilgrim/Planner';
import WalkingTable from '@/components/pilgrim/WalkingTable';
import shared from '@/components/pilgrim/shared.module.css';
import Reveal from '@/components/ui/Reveal';

const HERO = mediaPhoto('old-city-green-doors');

export async function generateMetadata({ params }: PageProps<'/[locale]/plan'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'plan', '/plan', HERO);
}

// /plan: the pilgrimage planner (a client component that keeps its answers in the URL), the walking times
// between the holy sites and where to go next.
export default async function PlanPage({ params }: PageProps<'/[locale]/plan'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const jsonLd = [
    webPageJsonLd(locale, {
      path: '/plan',
      name: t('pilgrim.plan.meta.title'),
      description: t('pilgrim.plan.meta.description'),
    }),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('pilgrim.nav.plan'), path: '/plan' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={HERO}
        size="medium"
        eyebrow={t('pilgrim.plan.hero.eyebrow')}
        title={t('pilgrim.plan.hero.title')}
        lead={t('pilgrim.plan.hero.lead')}
      />

      <section className="ui-section" aria-label={t('pilgrim.plan.hero.title')}>
        <div className="ui-container">
          <Planner />
        </div>
      </section>

      <section className="ui-section" aria-labelledby="walking-title" data-noprint>
        <div className="ui-container">
          <Reveal as="header" className={shared.head}>
            <h2 id="walking-title" className="ui-h2">
              {t('pilgrim.plan.walking.title')}
            </h2>
            <p className={shared.lead}>{t('pilgrim.plan.walking.lead')}</p>
          </Reveal>
          <WalkingTable />
        </div>
      </section>

      <NextSteps pages={['visit', 'gospel', 'gallery']} />
    </div>
  );
}
