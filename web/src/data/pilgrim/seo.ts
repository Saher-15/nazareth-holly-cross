import type { Metadata } from 'next';
import { CONTACT_EMAIL, SITE_URL } from '@/lib/config';
import { absoluteUrl, localePath } from '@/data/places/seo';

// Structured data (schema.org JSON-LD) shared by the pilgrim pages.

type JsonLd = Record<string, unknown>;

export type FaqEntry = { question: string; answer: string };

/** FAQPage: each question with its answer as plain text. */
export function faqJsonLd(entries: readonly FaqEntry[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    })),
  };
}

/** A page of the site as a schema.org WebPage (or a more precise page type), published by Nazareth Holy Cross. */
export function webPageJsonLd(
  locale: string,
  { type = 'WebPage', path, name, description, extra = {} }: { type?: string; path: string; name: string; description: string; extra?: JsonLd },
): JsonLd {
  const url = absoluteUrl(localePath(locale, path));
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': `${url}#page`,
    url,
    name,
    description,
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', name: 'Nazareth Holy Cross', url: SITE_URL },
    ...extra,
  };
}

/** Contact details of the organisation, for the contact page. */
export function contactPointJsonLd(name: string): JsonLd {
  return {
    '@type': 'Organization',
    name,
    url: SITE_URL,
    email: CONTACT_EMAIL,
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: CONTACT_EMAIL },
  };
}

/** Search engines should not index a page made of the visitor's own query. */
export const NO_INDEX: Pick<Metadata, 'robots'> = { robots: { index: false, follow: true } };
