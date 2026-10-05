import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { buildSearchIndex } from '@/data/pilgrim/searchIndex';
import type { Translate } from '@/data/pilgrim/faqEntries';
import { locales, routing } from '@/i18n/routing';

// The static search index of one language (/en/search-index.json): built at deploy time, loaded by the search
// palette the first time it opens.
export const dynamic = 'force-static';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function GET(_request: Request, { params }: RouteContext<'/[locale]/search-index.json'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response('Not found', { status: 404 });
  const t = (await getTranslations({ locale })) as Translate;
  return Response.json(buildSearchIndex(t, locale), {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
