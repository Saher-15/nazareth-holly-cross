'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { openSiteSearch } from '@/components/search/events';
import { CloseIcon, MenuIcon, SearchIcon } from '@/components/ui/icons';
import { usePathname } from '@/i18n/navigation';
import { headerNav } from '@/lib/site';
import type { LiveSeed } from '@/lib/useLiveStatus';
import BrandLogo from './BrandLogo';
import IntentLink from './IntentLink';
import LanguageSwitcher from './LanguageSwitcher';
import LiveNavIndicator from './LiveNavIndicator';
import styles from './SiteHeader.module.css';

/** What the open phone menu covers: it leaves the tab order and the accessibility tree until the menu closes.
 *  The floating corner buttons (accessibility settings, back to top) carry `data-floating`. */
const BEHIND_MENU = 'body > main, body > footer, [data-floating]';
const INERT_MARK = 'data-menu-inert';

/** How far the page scrolls before the bar turns solid. */
const SCROLLED_AFTER = 12;

/**
 * The site header: the logo medallion and the name, the main links, search, language and Donate. On phones and
 * tablets (1180px and below) the links open as a full-height sheet under the bar.
 * `live`: what the server last knew about a live broadcast (lib/liveStatusPeek.ts); the dot on the Live link
 * (LiveNavIndicator) follows the tab's live-status poller from there, without a reload.
 *
 * The bar has three looks (`data-look`, SiteHeader.module.css): `hero` over the home page's photo before scrolling
 * (no bar, only a soft shade), `glass` on the other pages at rest, `solid` after scrolling or while the menu is open.
 */
export default function SiteHeader({ live }: { live?: LiveSeed }) {
  const t = useTranslations('site');
  const ts = useTranslations('pilgrim.search');
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
    const onScroll = () => setScrolled(window.scrollY > SCROLLED_AFTER);
    onScroll();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // While the sheet is open the page behind it does not scroll and cannot be reached, and the sheet gets the focus.
  useEffect(() => {
    const root = document.documentElement;
    // The sheet layout is on while the menu button is shown (see the media query in SiteHeader.module.css).
    const isDrawer = () => !!buttonRef.current && getComputedStyle(buttonRef.current).display !== 'none';
    const release = () => {
      delete root.dataset.menuOpen;
      for (const el of document.querySelectorAll<HTMLElement>(`[${INERT_MARK}]`)) {
        el.inert = false;
        el.removeAttribute(INERT_MARK);
      }
    };
    let frame = 0;
    if (open && isDrawer()) {
      root.dataset.menuOpen = 'true';
      for (const el of document.querySelectorAll<HTMLElement>(BEHIND_MENU)) {
        if (el.inert) continue; // made inert by someone else: theirs to undo
        el.inert = true;
        el.setAttribute(INERT_MARK, '');
      }
      // One frame later: the sheet turns visible (and so focusable) when its open class has been painted.
      frame = requestAnimationFrame(() => navRef.current?.querySelector<HTMLElement>('a')?.focus());
    } else {
      release();
    }
    // Leaving the sheet layout (rotating a tablet, resizing) must not leave the page locked.
    const onResize = () => {
      if (!isDrawer()) {
        release();
        setOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      release();
    };
  }, [open]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const look = open ? 'solid' : scrolled ? 'solid' : pathname === '/' ? 'hero' : 'glass';

  // The search row of the phone sheet: the sheet closes first and the menu button takes the focus, so the search
  // palette (a modal dialog) gives the focus back to a button that is still on the screen when it closes.
  const searchFromSheet = () => {
    setOpen(false);
    buttonRef.current?.focus();
    openSiteSearch();
  };

  return (
    <header className={styles.header} data-look={look}>
      <a className="skip-link" href="#main">
        {t('skipToContent')}
      </a>
      <div className={`ui-container ${styles.bar}`}>
        <IntentLink href="/" className={styles.brand}>
          <BrandLogo className={styles.logo} sizes="(max-width: 480px) 40px, 46px" size={46} />
          {/* The brand is Latin in every language: left to right, so a cut-off name ends in "..." on its own end. */}
          <span className={styles.brandName} dir="ltr">
            {t('name')}
          </span>
        </IntentLink>

        <nav
          id="main-nav"
          ref={navRef}
          aria-label={t('name')}
          className={`${styles.nav} ${open ? styles.open : ''}`}
        >
          <ul>
            {headerNav.map((item) => (
              <li key={item.key}>
                <IntentLink
                  href={item.href}
                  className={styles.link}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {t(`nav.${item.key}`)}
                  {item.key === 'live' ? <LiveNavIndicator seed={live} /> : null}
                </IntentLink>
              </li>
            ))}
            {/* The same call to action as in the bar, shown last inside the sheet. */}
            <li className={styles.drawerCta}>
              <IntentLink href="/donate" className="ui-btn ui-btn--gold" onClick={() => setOpen(false)}>
                {t('nav.donate')}
              </IntentLink>
            </li>
            {/* Phones have no room for the search button in the bar: the sheet carries it. */}
            <li className={styles.sheetSearch}>
              <button type="button" className={styles.sheetSearchButton} aria-haspopup="dialog" onClick={searchFromSheet}>
                <SearchIcon size={20} />
                {ts('label')}
              </button>
            </li>
          </ul>
        </nav>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.search}`}
            aria-label={ts('label')}
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={openSiteSearch}
          >
            <SearchIcon size={20} />
          </button>
          <LanguageSwitcher />
          <IntentLink href="/donate" className={`ui-btn ui-btn--gold ui-btn--sm ${styles.donate}`}>
            {t('nav.donate')}
          </IntentLink>
          <button
            ref={buttonRef}
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}`}
            aria-expanded={open}
            aria-controls="main-nav"
            aria-label={open ? t('menuClose') : t('menuOpen')}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
