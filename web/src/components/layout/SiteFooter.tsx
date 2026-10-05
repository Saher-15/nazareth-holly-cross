import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CONTACT_EMAIL } from '@/lib/config';
import { footerNav, legalNav, pilgrimNav, socialLinks } from '@/lib/site';
import SearchButton from '@/components/search/SearchButton';
import styles from './SiteFooter.module.css';

export default async function SiteFooter() {
  const t = await getTranslations('site');
  const tp = await getTranslations('pilgrim');
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`ui-container ${styles.grid}`}>
        <section>
          <p className={styles.brand}>
            <span aria-hidden="true">✝</span> {t('name')}
          </p>
          <p className={styles.about}>{t('footer.about')}</p>
        </section>

        <nav aria-label={t('footer.explore')}>
          <h2 className={styles.heading}>{t('footer.explore')}</h2>
          <ul className={styles.links}>
            {footerNav.map((item) => (
              <li key={item.key}>
                <Link href={item.href}>{t(`nav.${item.key}`)}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={tp('nav.groupPlan')}>
          <h2 className={styles.heading}>{tp('nav.groupPlan')}</h2>
          <ul className={styles.links}>
            {pilgrimNav.map((item) => (
              <li key={item.key}>
                <Link href={item.href}>{tp(`nav.${item.key}`)}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={tp('nav.groupHelp')}>
          <h2 className={styles.heading}>{tp('nav.groupHelp')}</h2>
          <ul className={styles.links}>
            {legalNav.map((item) => (
              <li key={item.key}>
                <Link href={item.href}>{tp(`nav.${item.key}`)}</Link>
              </li>
            ))}
            <li>
              <SearchButton className={styles.linkButton} />
            </li>
          </ul>
        </nav>

        <section>
          <h2 className={styles.heading}>{t('footer.contact')}</h2>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <h2 className={styles.heading}>{t('footer.follow')}</h2>
          <ul className={styles.social}>
            {socialLinks.map((s) => (
              <li key={s.name}>
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className={styles.rights}>{t('footer.rights', { year })}</p>
    </footer>
  );
}
