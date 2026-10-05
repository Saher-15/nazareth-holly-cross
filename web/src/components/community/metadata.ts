import type { Metadata } from 'next';
import { openGraphLocale, pageAlternates } from '@/lib/seo';

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
    alternates: pageAlternates(locale, path),
    openGraph: {
      type: 'website',
      siteName,
      title,
      description,
      ...openGraphLocale(locale),
      url,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}
