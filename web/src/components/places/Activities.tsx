import { getTranslations } from 'next-intl/server';
import MediaPicture from '@/components/media/MediaPicture';
import { ArrowEndIcon } from '@/components/ui/icons';
import Reveal from '@/components/ui/Reveal';
import { getMedia } from '@/data/media';
import { placeHref } from '@/data/places/places';
import { Link } from '@/i18n/navigation';
import styles from './Activities.module.css';

// Things to do in Nazareth (the tour page, docs/DESIGN-GUIDE.md "Tour"). Real, lasting activities only, without
// prices, hours or dates that would go out of date or could not be checked; each photo is the place it names
// (licensed, credited on /credits). A card links to the site's own page when there is one.
const ACTIVITIES = [
  { key: 'oldcity', media: 'souk-vaulted-alley', href: placeHref('oldcity') },
  { key: 'basilica', media: 'basilica-upper-nave', href: placeHref('latin') },
  { key: 'trail', media: 'city-hills-galilee', href: null },
  { key: 'precipice', media: 'precipice-olive-viewpoint', href: null },
  { key: 'food', media: 'souk-arcade', href: null },
  { key: 'christmas', media: 'basilica-night-view', href: null },
] as const;

export default async function Activities({ id }: { id: string }) {
  const t = await getTranslations('tourPage.activities');
  return (
    <section id={id} className={`ui-section ${styles.section}`} aria-labelledby={`${id}-title`}>
      <div className="ui-container">
        <Reveal as="header" className={styles.head}>
          <p className="ui-eyebrow">{t('eyebrow')}</p>
          <h2 id={`${id}-title`} className="ui-h2">{t('title')}</h2>
          <p className={styles.lead}>{t('lead')}</p>
        </Reveal>
        <ul className={styles.grid}>
          {ACTIVITIES.map(({ key, media, href }, index) => {
            const item = getMedia(media);
            return (
              <li key={key} className={styles.card} data-testid="tour-activity">
                <Reveal className={styles.inner} delay={Math.min(index, 3) * 80}>
                  <div className={styles.media}>
                    <MediaPicture item={item} alt={item.alt} sizes="(max-width: 699px) 100vw, (max-width: 1039px) 50vw, 33vw" className={styles.photo} fill />
                  </div>
                  <div className={styles.body}>
                    <h3 className={`ui-h3 ${styles.title}`}>{t(`${key}.title`)}</h3>
                    <p className={styles.text}>{t(`${key}.text`)}</p>
                    {href ? (
                      <Link href={href} className={styles.more}>
                        {t('more')}
                        <ArrowEndIcon size={16} />
                      </Link>
                    ) : null}
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
