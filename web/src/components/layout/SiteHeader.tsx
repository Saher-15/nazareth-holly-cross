'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { mainNav } from '@/lib/site';
import LanguageSwitcher from './LanguageSwitcher';
import styles from './SiteHeader.module.css';

export default function SiteHeader() {
  const t = useTranslations('site');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close the mobile menu when the page changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <a className="skip-link" href="#main">
        {t('skipToContent')}
      </a>
      <div className={`ui-container ${styles.bar}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.cross} aria-hidden="true">
            ✝
          </span>
          <span>{t('name')}</span>
        </Link>

        <nav id="main-nav" aria-label={t('name')} className={`${styles.nav} ${open ? styles.open : ''}`}>
          <ul>
            {mainNav.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={styles.link}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <LanguageSwitcher />
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="main-nav"
            aria-label={open ? t('menuClose') : t('menuOpen')}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={styles.burger} data-open={open} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
