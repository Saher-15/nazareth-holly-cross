import { SITE_URL } from '@/lib/config';
import { organizationJsonLd } from '@/lib/jsonLd';

type HomeJsonLdInput = { locale: string; siteName: string; title: string; description: string };

// Structured data for the home page: who runs the site, the site itself, and this page.
export function homeJsonLd({ locale, siteName, title, description }: HomeJsonLdInput) {
  const organization = `${SITE_URL}/#organization`;
  const website = `${SITE_URL}/#website`;
  const page = `${SITE_URL}/${locale}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationJsonLd({ name: siteName, id: organization }),
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
        primaryImageOfPage: `${SITE_URL}/images/nazareth-media/city-sunset-glow/og.jpg`,
      },
    ],
  };
}
