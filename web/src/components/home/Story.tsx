import { useTranslations } from 'next-intl';
import MediaPicture from '@/components/media/MediaPicture';
import Reveal from '@/components/ui/Reveal';
import { getMedia } from '@/data/media';
import styles from './Story.module.css';

const NOTES = ['matthew', 'luke1', 'john', 'luke4'] as const;
const PARTS = ['part1', 'part2', 'part3', 'part4', 'part5'] as const;
// A licensed photo of the old city (docs/MEDIA.md): the "ancient stones" of the text. Credited on /credits.
const STORY_MEDIA = getMedia('old-city-arched-passage');

// Nazareth in Scripture, then the invitation to keep the city close: an editorial block, the photo beside the words
// (it stays in view while the text is read on a wide screen) instead of one long column of text.
export default function Story({ id }: { id: string }) {
  const t = useTranslations();

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <Reveal className={`ui-container ${styles.layout}`}>
        <figure className={styles.media}>
          <MediaPicture item={STORY_MEDIA} alt={STORY_MEDIA.alt} sizes="(max-width: 899px) 100vw, 45vw" className={styles.photo} fill />
        </figure>

        <div className={styles.words}>
          <header className={styles.head}>
            <p className="ui-eyebrow">{t('home.storyEyebrow')}</p>
            <h2 id={`${id}-title`} className="ui-h2">
              {t('whatIsNew.title')}
            </h2>
          </header>

          <ul className={styles.notes}>
            {NOTES.map((key) => (
              <li key={key} className={styles.note}>
                {t(`whatIsNew.scriptureNotes.${key}`)}
              </li>
            ))}
          </ul>

          <h3 className={`ui-h3 ${styles.subtitle}`}>{t('whatIsNew.touchingTheSacred')}</h3>
          <div className={styles.prose}>
            {PARTS.map((key, index) => (
              <p key={key} className={index === PARTS.length - 1 ? styles.closing : undefined}>
                {t(`whatIsNew.introParagraphs.${key}`)}
              </p>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
