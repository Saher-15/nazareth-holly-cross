import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { photo } from '@/data/places/places';
import PlaceHero from '@/components/places/PlaceHero';
import { ArrowIcon, ChurchIcon, GiftIcon, HandsHeartIcon } from '@/components/places/icons';
import JsonLd from '@/components/ui/JsonLd';
import Reveal from '@/components/ui/Reveal';
import { breadcrumbJsonLd, organizationJsonLd } from '@/lib/jsonLd';
import { absoluteUrl, localePath, pageMetadata } from '@/lib/seo';
import styles from './page.module.css';

const HERO = photo('greek', 10);

// The three ways the site brings Nazareth to visitors, one per About paragraph.
const PILLARS: readonly { icon: ReactNode; title: string; text: string; href: string; cta: string }[] = [
  { icon: <ChurchIcon size={26} />, title: 'placesPage.aboutPillar1', text: 'about.description2', href: '/tour', cta: 'heroSection.tourButton' },
  { icon: <GiftIcon size={26} />, title: 'placesPage.aboutPillar2', text: 'about.description3', href: '/shop', cta: 'home.shopAll' },
  { icon: <HandsHeartIcon size={26} />, title: 'placesPage.aboutPillar3', text: 'about.description4', href: '/candle', cta: 'home.stickyCandle' },
];

export async function generateMetadata({ params }: PageProps<'/[locale]/about'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'placesPage.meta' });
  return pageMetadata({
    locale,
    path: '/about',
    title: t('aboutTitle'),
    description: t('aboutDescription'),
    image: HERO,
  });
}

// /about: who we are, in an opening quote and three pillars (tour, shop, candle).
export default async function AboutPage({ params }: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: t('placesPage.meta.aboutTitle'),
      description: t('placesPage.meta.aboutDescription'),
      url: absoluteUrl(localePath(locale, '/about')),
      inLanguage: locale,
      mainEntity: organizationJsonLd({ name: t('site.name') }),
    },
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('site.nav.about'), path: '/about' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero image={HERO} size="medium" eyebrow={t('placesPage.aboutEyebrow')} title={t('about.title')} />

      <section className={`ui-section ${styles.intro}`}>
        <div className="ui-container">
          <Reveal className={`ui-glass ${styles.quote}`}>
            <span className={styles.mark} aria-hidden="true" />
            <p className={styles.lead}>{t('about.description1')}</p>
          </Reveal>
        </div>
      </section>

      <section className="ui-section">
        <div className="ui-container">
          <ul className={styles.pillars}>
            {PILLARS.map((pillar, i) => (
              <Reveal as="li" key={pillar.title} className={`ui-glass ui-card ${styles.pillar}`} delay={i * 90}>
                <span className={styles.icon} aria-hidden="true">
                  {pillar.icon}
                </span>
                <h2 className="ui-h3">{t(pillar.title)}</h2>
                <p className={styles.text}>{t(pillar.text)}</p>
                <Link href={pillar.href} className={styles.link}>
                  {t(pillar.cta)}
                  <ArrowIcon size={16} className={styles.arrow} />
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
