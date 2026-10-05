'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { locales, localeNames, type Locale } from '@/i18n/routing';
import styles from './SiteFooter.module.css';

// Every language as a real link to the same page in that language (crawlable, works without
// JavaScript's help, and each name is written in its own language). The current one is marked.
// Prefetch is off: eleven languages of a page are not worth warming up.
export default function FooterLanguages() {
  const current = useLocale() as Locale;
  const pathname = usePathname();

  return (
    <ul className={styles.languages}>
      {locales.map((locale) => (
        <li key={locale}>
          <Link
            href={pathname}
            locale={locale}
            lang={locale}
            hrefLang={locale}
            prefetch={false}
            className={styles.language}
            aria-current={locale === current ? 'true' : undefined}
          >
            {localeNames[locale]}
          </Link>
        </li>
      ))}
    </ul>
  );
}
