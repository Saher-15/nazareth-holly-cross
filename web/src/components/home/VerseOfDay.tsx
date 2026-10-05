import { useTranslations } from 'next-intl';
import Reveal from '@/components/ui/Reveal';
import { NAZARETH_TIME_ZONE, nazarethDate, verseNumberFor } from './verse';
import styles from './VerseOfDay.module.css';

type Props = { id: string; locale: string; now?: Date };

// Rendered on the server: every visitor sees the same verse on the same day in Nazareth.
export default function VerseOfDay({ id, locale, now = new Date() }: Props) {
  const t = useTranslations('home');
  const isoDate = nazarethDate(now);
  const n = verseNumberFor(isoDate);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: NAZARETH_TIME_ZONE,
    numberingSystem: 'latn',
  }).format(now);

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <Reveal className="ui-container">
        <figure className={`ui-glass ${styles.card}`} data-verse={n}>
          <h2 id={`${id}-title`} className={`ui-eyebrow ${styles.eyebrow}`}>
            {t('verseEyebrow')}{' '}
            <time className={styles.date} dateTime={isoDate}>
              · {dateLabel}
            </time>
          </h2>
          <blockquote className={styles.text}>
            <p>{t(`v${n}`)}</p>
          </blockquote>
          <figcaption className={styles.ref}>{t(`r${n}`)}</figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
