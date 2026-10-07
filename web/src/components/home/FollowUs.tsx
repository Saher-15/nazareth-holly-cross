import { useTranslations } from 'next-intl';
import { FacebookIcon, InstagramIcon, YoutubeIcon } from '@/components/ui/icons';
import { socialLinks } from '@/lib/site';
import styles from './FollowUs.module.css';

const ICONS = { Instagram: InstagramIcon, Facebook: FacebookIcon, YouTube: YoutubeIcon } as const;

// "Follow us": the site's three social profiles as labelled buttons (no newsletter box, no embedded feed, no script
// from the networks: plain links that open in a new tab).
export default function FollowUs({ id }: { id: string }) {
  const t = useTranslations();
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={`ui-container ${styles.inner}`}>
        <h2 id={`${id}-title`} className={`ui-h3 ${styles.title}`}>
          {t('site.footer.follow')}
        </h2>
        <ul className={styles.links}>
          {socialLinks.map((link) => {
            const Icon = ICONS[link.name];
            return (
              <li key={link.name}>
                <a
                  href={link.href}
                  className="ui-btn ui-btn--glass"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('ux.footer.followOn', { network: link.name })}
                >
                  <Icon size={20} />
                  {link.name}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
