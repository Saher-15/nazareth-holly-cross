'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CloseIcon, CrossMark, MenuIcon } from '@/components/ui/icons';
import { Link, usePathname } from '@/i18n/navigation';
import { mainNav } from '@/lib/site';
import LanguageSwitcher from './LanguageSwitcher';
import styles from './SiteHeader.module.css';

/** `liveNow`: a live broadcast is on (the server's last look, lib/liveStatusPeek.ts): a dot on the Live link. */
export default function SiteHeader({ liveNow = false }: { liveNow?: boolean }) {
  const t = useTranslations('site');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close the mobile menu when the page changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen((wasOpen) => {
        // Closing with the keyboard hands the focus back to the button that opened the menu.
        if (wasOpen && navRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
        return false;
      });
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

  // While the drawer is open the page behind it does not scroll, and the drawer gets the focus.
  useEffect(() => {
    const root = document.documentElement;
    // The drawer layout is on while the menu button is shown (see the media query in SiteHeader.module.css).
    const isDrawer = () => !!buttonRef.current && getComputedStyle(buttonRef.current).display !== 'none';
    let frame = 0;
    if (open && isDrawer()) {
      root.dataset.menuOpen = 'true';
      // One frame later: the drawer turns visible (and so focusable) when its open class has been painted.
      frame = requestAnimationFrame(() => navRef.current?.querySelector<HTMLElement>('a')?.focus());
    } else {
      delete root.dataset.menuOpen;
    }
    // Leaving the drawer layout (rotating a tablet, resizing) must not leave the page locked.
    const onResize = () => {
      if (!isDrawer()) {
        delete root.dataset.menuOpen;
        setOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      delete root.dataset.menuOpen;
    };
  }, [open]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <a className="skip-link" href="#main">
        {t('skipToContent')}
      </a>
      <div className={`ui-container ${styles.bar}`}>
        <Link href="/" className={styles.brand}>
          <CrossMark size={26} className={styles.cross} />
          <span className={styles.brandName}>{t('name')}</span>
        </Link>

        <nav
          id="main-nav"
          ref={navRef}
          aria-label={t('name')}
          className={`${styles.nav} ${open ? styles.open : ''}`}
        >
          <ul>
            {mainNav.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={styles.link}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {t(`nav.${item.key}`)}
                  {item.key === 'live' && liveNow ? (
                    <>
                      <span className={styles.liveDot} aria-hidden="true" data-testid="nav-live-now" />{' '}
                      <span className="visually-hidden">{t('nav.liveNow')}</span>
                    </>
                  ) : null}
                </Link>
              </li>
            ))}
            {/* The same call to action as in the bar, shown last inside the drawer. */}
            <li className={styles.drawerCta}>
              <Link href="/donate" className="ui-btn ui-btn--gold" onClick={() => setOpen(false)}>
                {t('nav.donate')}
              </Link>
            </li>
          </ul>
        </nav>

        <div className={styles.actions}>
          <Link href="/donate" className={`ui-btn ui-btn--gold ui-btn--sm ${styles.donate}`}>
            {t('nav.donate')}
          </Link>
          <LanguageSwitcher />
          <button
            ref={buttonRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="main-nav"
            aria-label={open ? t('menuClose') : t('menuOpen')}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />}
    </header>
  );
}
