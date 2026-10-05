import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MEDIA, MEDIA_TOPICS, mediaByTopic, mediaShareFile, type MediaItem } from '@/data/media';
import { mediaPhoto } from '@/data/places/places';
import { absoluteUrl, breadcrumbJsonLd, localePath, pageMetadata } from '@/data/places/seo';
import MediaPicture from '@/components/media/MediaPicture';
import ExternalLink from '@/components/places/ExternalLink';
import JsonLd from '@/components/places/JsonLd';
import PlaceHero from '@/components/places/PlaceHero';
import Reveal from '@/components/ui/Reveal';
import styles from './page.module.css';

const HERO = 'basilica-dome-palms';

export async function generateMetadata({ params }: PageProps<'/[locale]/credits'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'media.meta' });
  return pageMetadata({
    locale,
    path: '/credits',
    title: t('creditsTitle'),
    description: t('creditsDescription'),
    image: mediaPhoto(HERO),
  });
}

/** schema.org ImageObject: lets search engines show the licence and the author next to the photo. */
const imageJsonLd = (item: MediaItem, name: string) => ({
  '@type': 'ImageObject',
  name,
  contentUrl: absoluteUrl(mediaShareFile(item)),
  creditText: item.credit,
  creator: { '@type': 'Person', name: item.author },
  license: item.licenseUrl || undefined,
  acquireLicensePage: item.sourceUrl,
  copyrightNotice: item.credit,
});

// /credits: every licensed photograph on the site with its author, licence and source (Wikimedia Commons).
export default async function CreditsPage({ params }: PageProps<'/[locale]/credits'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tm = await getTranslations('media');

  const titleOf = (item: MediaItem) =>
    tm('alt', { topic: tm(`topic.${item.topic}`), subject: tm(`subject.${item.subject}`) });

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: tm('meta.creditsTitle'),
      description: tm('meta.creditsDescription'),
      url: absoluteUrl(localePath(locale, '/credits')),
      inLanguage: locale,
      hasPart: MEDIA.map((item) => imageJsonLd(item, titleOf(item))),
    },
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: tm('credits.title'), path: '/credits' },
    ]),
  ];

  const topics = MEDIA_TOPICS.filter((topic) => mediaByTopic(topic).length > 0);

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={mediaPhoto(HERO)}
        size="medium"
        eyebrow={tm('credits.eyebrow')}
        title={tm('credits.title')}
        lead={tm('credits.lead')}
      />

      <section className="ui-section" aria-labelledby="credits-how">
        <div className="ui-container">
          <Reveal className={`ui-glass ui-card ${styles.how}`}>
            <h2 id="credits-how" className="ui-h3">
              {tm('credits.howTitle')}
            </h2>
            <p>{tm('credits.howText')}</p>
            <p className="ui-muted">{tm('credits.howNote')}</p>
            <nav aria-label={tm('credits.jump')}>
              <ul className={styles.jump}>
                {topics.map((topic) => (
                  <li key={topic}>
                    <a href={`#credits-${topic}`}>{tm(`topic.${topic}`)}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>
        </div>
      </section>

      {topics.map((topic) => {
        const items = mediaByTopic(topic);
        return (
          <section key={topic} id={`credits-${topic}`} className={`ui-section ${styles.group}`} aria-labelledby={`credits-${topic}-title`}>
            <div className="ui-container">
              <header className={styles.head}>
                <h2 id={`credits-${topic}-title`} className="ui-h2">
                  {tm(`topic.${topic}`)}
                </h2>
                <p className="ui-muted">{t('placesPage.photoCount', { count: items.length })}</p>
              </header>
              <ul className={styles.grid}>
                {items.map((item) => (
                  <li key={item.id} className={`ui-glass ${styles.card}`}>
                    <div className={styles.thumb}>
                      <MediaPicture item={item} alt={titleOf(item)} sizes="(min-width: 1000px) 380px, (min-width: 640px) 45vw, 100vw" fill />
                    </div>
                    <div className={styles.body}>
                      <h3 className={styles.name}>{titleOf(item)}</h3>
                      <dl className={styles.facts}>
                        <div>
                          <dt>{tm('credits.author')}</dt>
                          <dd>{item.author}</dd>
                        </div>
                        <div>
                          <dt>{tm('credits.license')}</dt>
                          <dd>
                            {item.licenseUrl ? (
                              <ExternalLink href={item.licenseUrl} newTabLabel={t('placesPage.newTab')}>
                                {item.license}
                              </ExternalLink>
                            ) : (
                              item.license
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>{tm('source')}</dt>
                          <dd>
                            <ExternalLink href={item.sourceUrl} newTabLabel={t('placesPage.newTab')}>
                              {tm('credits.viewOnCommons')}
                            </ExternalLink>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
