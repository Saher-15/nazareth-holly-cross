import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import MediaPicture from '@/components/media/MediaPicture';
import Flame from '@/components/ui/Flame';
import MotionToggle from '@/components/ui/MotionToggle';
import { getMedia, mediaShareFile } from '@/data/media';
import HeroVideo from './HeroVideo';
import SoundToggle from './SoundToggle';
import { ChevronDown } from './icons';
import styles from './HomeHero.module.css';

export const HERO_ID = 'home-hero';
// A licensed 2560 px photo (docs/MEDIA.md), served as AVIF/WebP in four widths. The film (the whole virtual tour of the
// city, silent) fades in over it on wide screens with a good connection only.
const HERO_MEDIA = getMedia('city-sunset-glow');
/** The social card of the home page. */
export const HERO_POSTER = mediaShareFile(HERO_MEDIA);

// Full-bleed opening of the home page: poster photo (the LCP image), optional
// background video, the promise of the site and its three main paths.
export default function HomeHero({ nextSectionId }: { nextSectionId: string }) {
  const t = useTranslations();

  return (
    <section id={HERO_ID} className={styles.hero} aria-labelledby="home-title" data-motion-scope="">
      <div className={styles.media}>
        <MediaPicture className={styles.poster} item={HERO_MEDIA} alt="" sizes="(max-width: 767px) 700px, 100vw" lean fill priority />
        <HeroVideo />
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

      <MotionToggle className={`${styles.sound} ${styles.motion}`} />
      <SoundToggle />

      <a className={styles.scroll} href={`#${nextSectionId}`}>
        <span>{t('home.scroll')}</span>
        <ChevronDown className={styles.bob} />
      </a>
    </section>
  );
}
