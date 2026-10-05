import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getPlace, photo, placeHref } from '@/data/places/places';
import { breadcrumbJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { PASSAGES } from '@/data/pilgrim/gospel';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import JsonLd from '@/components/ui/JsonLd';
import PlaceHero from '@/components/places/PlaceHero';
import { ArrowIcon } from '@/components/places/icons';
import NextSteps from '@/components/pilgrim/NextSteps';
import shared from '@/components/pilgrim/shared.module.css';
import Reveal from '@/components/ui/Reveal';
import styles from './page.module.css';

const HERO = photo('latin', 19);

export async function generateMetadata({ params }: PageProps<'/[locale]/gospel'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'gospel', '/gospel', HERO);
}

// /gospel: Nazareth in the Gospels. Eight well-known passages in the order of the story, each with a short
// reflection and the holy site that keeps its memory alive. The quotes come from messages in every language.
export default async function GospelPage({ params }: PageProps<'/[locale]/gospel'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const jsonLd = [
    webPageJsonLd(locale, {
      type: 'CollectionPage',
      path: '/gospel',
      name: t('pilgrim.gospel.meta.title'),
      description: t('pilgrim.gospel.meta.description'),
      extra: {
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: PASSAGES.length,
          itemListElement: PASSAGES.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: { '@type': 'Quotation', text: t(p.quote), citation: t(p.ref) },
          })),
        },
      },
    }),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('pilgrim.nav.gospel'), path: '/gospel' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={HERO}
        size="medium"
        eyebrow={t('pilgrim.gospel.hero.eyebrow')}
        title={t('pilgrim.gospel.hero.title')}
        lead={t('pilgrim.gospel.hero.lead')}
      />

      <section className="ui-section" aria-labelledby="gospel-passages-title">
        <div className="ui-container">
          <Reveal as="header" className={shared.head}>
            <h2 id="gospel-passages-title" className="ui-h2">
              {t('pilgrim.gospel.intro.title')}
            </h2>
            <p className={shared.lead}>{t('pilgrim.gospel.intro.text')}</p>
          </Reveal>

          <ol className={styles.passages}>
            {PASSAGES.map((passage, i) => {
              const place = getPlace(passage.place)!;
              const name = t(place.nameKey);
              return (
                <Reveal as="li" key={passage.id} className={`ui-glass ${styles.passage}`} delay={(i % 2) * 80}>
                  <figure id={passage.id} className={styles.quote}>
                    <blockquote>
                      <p>{t(passage.quote)}</p>
                    </blockquote>
                    <figcaption>
                      <cite>{t(passage.ref)}</cite>
                    </figcaption>
                  </figure>
                  <p className={styles.reflection}>{t(passage.reflection)}</p>
                  <Link href={placeHref(place.slug)} className={styles.site}>
                    <span className={styles.thumb}>
                      <Image src={place.cover.src} alt="" fill sizes="64px" />
                    </span>
                    <span className={styles.siteText}>
                      <span className={styles.siteLabel}>{t('pilgrim.gospel.visitSite')}</span>
                      <span className={styles.siteName}>{name}</span>
                    </span>
                    <ArrowIcon size={18} className={styles.arrow} />
                  </Link>
                </Reveal>
              );
            })}
          </ol>
          <p className={styles.note}>{t('pilgrim.gospel.note')}</p>
        </div>
      </section>

      <NextSteps pages={['plan', 'prayers', 'visit']} />
    </div>
  );
}
