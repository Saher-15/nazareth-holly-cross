import type { Metadata } from 'next';
import { locales } from '@/i18n/routing';
import { ogLocale } from '@/lib/seo';

type Options = {
  locale: string;
  /** The page's path without the language, e.g. "/reviews". */
  path: string;
  title: string;
  description: string;
  siteName: string;
  image?: string;
};

// Title, description, canonical URL and the hreflang list for a community page. The layout's own
// canonical points at the home page, so every page must set its own.
export function communityMetadata({ locale, path, title, description, siteName, image }: Options): Metadata {
  const url = `/${locale}${path}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])), 'x-default': `/en${path}` },
    },
    openGraph: {
      type: 'website',
      siteName,
      title,
      description,
      locale: ogLocale(locale),
      url,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}
