import { CONTACT_EMAIL, SITE_URL } from '@/lib/config';
import { socialLinks } from '@/lib/site';

type HomeJsonLdInput = { locale: string; siteName: string; title: string; description: string };

// Structured data for the home page: who runs the site, the site itself, and this page.
export function homeJsonLd({ locale, siteName, title, description }: HomeJsonLdInput) {
  const organization = `${SITE_URL}/#organization`;
  const website = `${SITE_URL}/#website`;
  const page = `${SITE_URL}/${locale}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organization,
        name: siteName,
        url: SITE_URL,
        logo: `${SITE_URL}/images/logo.webp`,
        email: CONTACT_EMAIL,
        sameAs: socialLinks.map((s) => s.href),
      },
      {
        '@type': 'WebSite',
        '@id': website,
        name: siteName,
        url: SITE_URL,
        publisher: { '@id': organization },
      },
      {
        '@type': 'WebPage',
        '@id': `${page}#webpage`,
        url: page,
        name: title,
        description,
        inLanguage: locale,
        isPartOf: { '@id': website },
        about: { '@type': 'City', name: 'Nazareth' },
        primaryImageOfPage: `${SITE_URL}/images/nazareth/nazareth1.webp`,
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so no text can close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
