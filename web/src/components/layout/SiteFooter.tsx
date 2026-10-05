import { getTranslations } from 'next-intl/server';
import { CrossMark, FacebookIcon, InstagramIcon, MailIcon, PinIcon, YoutubeIcon } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { CONTACT_EMAIL } from '@/lib/config';
import { footerNav, socialLinks } from '@/lib/site';
import FooterLanguages from './FooterLanguages';
import styles from './SiteFooter.module.css';

const SOCIAL_ICONS = { Instagram: InstagramIcon, Facebook: FacebookIcon, YouTube: YoutubeIcon } as const;

// Four quiet columns: who we are and where to follow, where to go, how to reach us, and the languages.
// No newsletter form and no cookie banner: nothing here asks the visitor for anything.
export default async function SiteFooter() {
  const t = await getTranslations('site');
  const tx = await getTranslations('ux.footer');
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`ui-container ${styles.grid}`}>
        <section className={styles.about}>
          <p className={styles.brand}>
            <CrossMark size={30} className={styles.mark} />
            <span>{t('name')}</span>
          </p>
          <p className={styles.tagline}>{t('footer.about')}</p>
          <ul className={styles.social} aria-label={t('footer.follow')}>
            {socialLinks.map((s) => {
              const Icon = SOCIAL_ICONS[s.name as keyof typeof SOCIAL_ICONS];
              return (
                <li key={s.name}>
                  <a
                    href={s.href}
                    className={styles.socialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tx('followOn', { network: s.name })}
                  >
                    {Icon && <Icon size={22} />}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <nav aria-label={t('footer.explore')}>
          <h2 className={styles.heading}>{t('footer.explore')}</h2>
          <ul className={styles.links}>
            {footerNav
              .filter((item) => item.key !== 'donate') /* it has its own button below */
              .map((item) => (
              <li key={item.key}>
                <Link href={item.href} className={styles.link}>
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section>
          <h2 className={styles.heading}>{t('footer.contact')}</h2>
          <ul className={styles.contact}>
            <li>
              <MailIcon size={18} />
              <a href={`mailto:${CONTACT_EMAIL}`} className={`${styles.link} ui-ltr`}>
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <PinIcon size={18} />
              <span>{tx('address')}</span>
            </li>
          </ul>
          <Link href="/donate" className={`ui-btn ui-btn--ghost ui-btn--sm ${styles.donate}`}>
            {t('nav.donate')}
          </Link>
        </section>

        <nav aria-label={tx('languages')}>
          <h2 className={styles.heading}>{tx('languages')}</h2>
          <FooterLanguages />
        </nav>
      </div>
      <p className={styles.rights}>{t('footer.rights', { year })}</p>
    </footer>
  );
}
