import { getTranslations } from 'next-intl/server';
import { INTRO_OVERLAY_ATTRIBUTE } from '@/lib/intro';
import styles from './OpeningDoor.module.css';

// The opening of the site (lib/intro.ts decides when and ends it; docs/DESIGN-GUIDE.md 1.5): a double door swings open
// on a strong light, "Welcome to Nazareth · Jesus City" appears in it, and the light fades into the home page. Pure
// CSS in the server HTML, hidden unless <html data-intro>; no JavaScript of its own. Any key, click, tap or scroll
// skips it. Decorative and short (under 4 seconds), so it is hidden from screen readers: the page's own heading
// follows.
export default async function OpeningDoor() {
  const t = await getTranslations('home.intro');
  return (
    <div className={styles.intro} aria-hidden="true" data-testid="opening-door" {...{ [INTRO_OVERLAY_ATTRIBUTE]: '' }}>
      <div className={styles.light} />
      <div className={styles.doors}>
        <div className={`${styles.door} ${styles.doorA}`}><span className={styles.handle} /></div>
        <div className={`${styles.door} ${styles.doorB}`}><span className={styles.handle} /></div>
      </div>
      <div className={styles.seam} />
      <p className={styles.greeting}>
        <span className={styles.welcome}>{t('welcome')}</span>
        <span className={styles.tagline}>{t('tagline')}</span>
      </p>
    </div>
  );
}
