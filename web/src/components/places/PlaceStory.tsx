import { getTranslations } from 'next-intl/server';
import type { StoryBlock } from '@/data/places/places';
import styles from './PlaceStory.module.css';

// The text of a place: a lead paragraph, then paragraphs, titled sections or titled lists of points.
export default async function PlaceStory({ story }: { story: readonly StoryBlock[] }) {
  const t = await getTranslations();

  return (
    <div className={styles.prose}>
      {story.map((block, i) => {
        if (block.kind === 'points') {
          return (
            <section key={block.title} className={styles.block}>
              <h3 className="ui-h3">{t(block.title)}</h3>
              <ul className={styles.points}>
                {block.points.map(([title, text]) => (
                  <li key={title} className={styles.point}>
                    <strong className={styles.pointTitle}>{t(title)}</strong>
                    <span>{t(text)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        }
        if (block.kind === 'section') {
          return (
            <section key={block.title} className={styles.block}>
              <h3 className="ui-h3">{t(block.title)}</h3>
              <p>{t(block.text)}</p>
            </section>
          );
        }
        return (
          <p key={block.text} className={i === 0 ? styles.lead : undefined}>
            {t(block.text)}
          </p>
        );
      })}
    </div>
  );
}
