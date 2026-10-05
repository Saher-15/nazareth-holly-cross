import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Flame from './Flame';
import HeroVideo from './HeroVideo';
import SoundToggle from './SoundToggle';
import { ChevronDown } from './icons';
import styles from './HomeHero.module.css';

export const HERO_ID = 'home-hero';
export const HERO_POSTER = '/images/nazareth/nazareth1.webp';

// Full-bleed opening of the home page: poster photo (the LCP image), optional
// background video, the promise of the site and its three main paths.
export default function HomeHero({ nextSectionId }: { nextSectionId: string }) {
  const t = useTranslations();

  return (
    <section id={HERO_ID} className={styles.hero} aria-labelledby="home-title">
      <div className={styles.media}>
        <Image className={styles.poster} src={HERO_POSTER} alt="" fill preload sizes="100vw" />
        <HeroVideo poster={HERO_POSTER} />
        <div className={styles.shade} />
      </div>

      <div className={styles.content}>
        <p className={`ui-eyebrow ${styles.eyebrow}`}>{t('home.eyebrow')}</p>
        <h1 id="home-title" className={styles.title}>
          {t('home.title')}
        </h1>
        <p className={styles.sub}>{t('home.subtitle')}</p>

        <div className={styles.actions}>
          <Link href="/candle" className={`ui-btn ui-btn--gold ${styles.big}`}>
            <Flame size="sm" />
            {t('heroSection.lightCandle')}
          </Link>
          <Link href="/tour" className={`ui-btn ui-btn--glass ${styles.big}`}>
            {t('heroSection.tourButton')}
          </Link>
          <Link href="/shop" className={`ui-btn ui-btn--glass ${styles.big}`}>
            {t('heroSection.shopButton')}
          </Link>
        </div>

        <Link href="/shop" className={styles.offer}>
          {t('heroSection.discount')}
        </Link>
      </div>

      <SoundToggle />

      <a className={styles.scroll} href={`#${nextSectionId}`}>
        <span>{t('home.scroll')}</span>
        <ChevronDown className={styles.bob} />
      </a>
    </section>
  );
}
