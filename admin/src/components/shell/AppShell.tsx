'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { FeedbackProvider } from '@/components/ui/Feedback';
import { useI18n } from '@/i18n/client';
import { initials } from '@/lib/format';
import { NAV, can, type NavId, type Role } from '@/lib/roles';
import { BrandMark } from './Brand';
import { IdleGuard, signOut } from './IdleGuard';
import { LanguageSwitcher } from './LanguageSwitcher';

const ICONS: Record<NavId, IconName> = {
  dashboard: 'dashboard',
  live: 'broadcast',
  campaigns: 'chart',
  orders: 'orders',
  payments: 'payments',
  candles: 'candles',
  contacts: 'mail',
  products: 'products',
  pricing: 'flame',
  candleVideos: 'video',
  reviews: 'reviews',
  prayers: 'prayers',
  users: 'users',
  audit: 'audit',
  privacy: 'userX',
  settings: 'settings',
  profile: 'profile',
};

// Pages that must be opened with a full page load (their Permissions-Policy differs from the rest of the dashboard).
const FULL_LOAD = new Set<NavId>(['live']);

const GROUPS: { label: 'shell.groupOverview' | 'shell.groupInbox' | 'shell.groupCatalog' | 'shell.groupAdmin'; ids: NavId[] }[] = [
  { label: 'shell.groupOverview', ids: ['dashboard', 'live', 'campaigns'] },
  { label: 'shell.groupInbox', ids: ['orders', 'payments', 'candles', 'contacts', 'prayers', 'reviews'] },
  { label: 'shell.groupCatalog', ids: ['products', 'pricing', 'candleVideos'] },
  { label: 'shell.groupAdmin', ids: ['users', 'audit', 'privacy', 'settings', 'profile'] },
];

export function AppShell({ user, expiresAt, children }: { user: { username: string; role: Role }; expiresAt: number | null; children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const items = NAV.filter((item) => !item.needs || can(user.role, item.needs));

  // Escape closes the phone menu; choosing a link closes it too (onClick below).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const current = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <FeedbackProvider>
      <div className="shell">
        <header className="topbar">
          <button ref={menuButton} type="button" className="icon-btn" aria-label={t('shell.menu')} aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen((v) => !v)}>
            <Icon name="menu" />
          </button>
          <Link href="/" className="brand brand--compact">
            <BrandMark size={28} />
            <span className="brand__name">{t('shell.brand')}</span>
          </Link>
        </header>

        <div className="scrim" data-open={open} onClick={() => setOpen(false)} aria-hidden="true" />

        <aside id="sidebar" className="sidebar" data-open={open}>
          <Link href="/" className="brand">
            <BrandMark />
            <span className="brand__text">
              <span className="brand__name">{t('shell.brand')}</span>
              <span className="brand__sub">{t('shell.brandSub')}</span>
            </span>
          </Link>

          <nav className="nav" aria-label={t('shell.navigation')}>
            {GROUPS.map((group) => {
              const visible = group.ids.map((id) => items.find((item) => item.id === id)).filter((item) => item !== undefined);
              if (!visible.length) return null;
              return (
                <div key={group.label} className="nav__group">
                  <p className="nav__label">{t(group.label)}</p>
                  <ul className="nav__list">
                    {visible.map((item) => {
                      const content = (
                        <>
                          <Icon name={ICONS[item.id]} />
                          <span>{t(`nav.${item.id}`)}</span>
                        </>
                      );
                      const props = { className: 'nav__link', 'aria-current': current(item.href) ? ('page' as const) : undefined, onClick: () => setOpen(false) };
                      return (
                        <li key={item.id}>
                          {FULL_LOAD.has(item.id) ? (
                            // A full page load on purpose: the camera and microphone are allowed only on /live, and the
                            // browser decides that from the headers of the page it LOADED (next.config.ts).
                            <a href={item.href} {...props}>{content}</a>
                          ) : (
                            <Link href={item.href} {...props}>{content}</Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>

          <div className="sidebar__foot">
            <LanguageSwitcher />
            <div className="usercard">
              <span className="usercard__avatar" aria-hidden="true">{initials(user.username)}</span>
              <span className="usercard__text">
                <span className="usercard__name">{user.username}</span>
                <span className="usercard__role">{t(`role.${user.role}`)}</span>
              </span>
              <button type="button" className="icon-btn" aria-label={t('shell.signOut')} title={t('shell.signOut')} onClick={() => void signOut('manual')} data-testid="sign-out">
                <Icon name="logout" />
              </button>
            </div>
          </div>
        </aside>

        <main id="main" className="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <IdleGuard expiresAt={expiresAt} />
    </FeedbackProvider>
  );
}
