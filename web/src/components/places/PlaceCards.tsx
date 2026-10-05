import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { PlaceCard } from '@/data/places/places';
import Reveal from '@/components/ui/Reveal';
import { ArrowIcon } from './icons';
import PhotoImage from './PhotoImage';
import styles from './PlaceCards.module.css';

// Photo cards linking to holy places (and the tour): "Continue the journey" and the tour page.
export default async function PlaceCards({ cards }: { cards: readonly PlaceCard[] }) {
  const t = await getTranslations();

  return (
    <ul className={styles.grid}>
      {cards.map((card, i) => (
        <Reveal as="li" key={card.key} className={styles.item} delay={Math.min(i, 5) * 70}>
          <Link href={card.href} className={styles.card}>
            <PhotoImage photo={card.cover} alt="" sizes="(min-width: 1100px) 230px, (min-width: 700px) 33vw, 50vw" />
            <span className={styles.shade} aria-hidden="true" />
            <span className={styles.body}>
              <span className={styles.name}>{t(card.nameKey)}</span>
              <span className={styles.go} aria-hidden="true">
                {t('home.explore')} <ArrowIcon size={14} className={styles.arrow} />
              </span>
            </span>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
