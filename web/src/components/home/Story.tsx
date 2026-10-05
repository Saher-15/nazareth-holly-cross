import { useTranslations } from 'next-intl';
import Reveal from '@/components/ui/Reveal';
import styles from './Story.module.css';

const NOTES = ['matthew', 'luke1', 'john', 'luke4'] as const;
const PARTS = ['part1', 'part2', 'part3', 'part4', 'part5'] as const;

// Nazareth in Scripture, then the invitation to keep the city close.
export default function Story({ id }: { id: string }) {
  const t = useTranslations();

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <Reveal className="ui-container">
        <header className={styles.head}>
          <p className="ui-eyebrow">{t('home.storyEyebrow')}</p>
          <h2 id={`${id}-title`} className="ui-h2">
            {t('whatIsNew.title')}
          </h2>
        </header>

        <ul className={styles.notes}>
          {NOTES.map((key) => (
            <li key={key} className={`ui-glass ${styles.note}`}>
              {t(`whatIsNew.scriptureNotes.${key}`)}
            </li>
          ))}
        </ul>

        <h3 className={`ui-h3 ${styles.subtitle}`}>{t('whatIsNew.touchingTheSacred')}</h3>
        <div className={styles.prose}>
          {PARTS.map((key) => (
            <p key={key}>{t(`whatIsNew.introParagraphs.${key}`)}</p>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
