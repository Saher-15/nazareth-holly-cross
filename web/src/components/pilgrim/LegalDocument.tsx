import type { ReactNode } from 'react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { breadcrumbJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { faqValues, type Translate } from '@/data/pilgrim/faqEntries';
import { LEGAL, type LegalPage } from '@/data/pilgrim/legal';
import { CONTACT_EMAIL } from '@/lib/config';
import { legalNav } from '@/lib/site';
import JsonLd from '@/components/ui/JsonLd';
import PageHero from '@/components/ui/PageHero';
import { getMedia } from '@/data/media';
import shared from './shared.module.css';

/** When the legal texts were last revised (YYYY-MM-DD). Update it with every change to the messages. */
export const LEGAL_UPDATED = '2026-10-05';
/** When the site's accessibility was last reviewed and the statement written (docs/ACCESSIBILITY.md). */
export const A11Y_REVIEWED = '2026-10-07';

const PATH: Record<LegalPage, string> = {
  privacy: '/privacy',
  terms: '/terms',
  shipping: '/shipping-returns',
  accessibility: '/accessibility',
};
const NAV_KEY: Record<LegalPage, string> = { privacy: 'privacy', terms: 'terms', shipping: 'shipping', accessibility: 'accessibility' };
const UPDATED: Record<LegalPage, string> = {
  privacy: LEGAL_UPDATED,
  terms: LEGAL_UPDATED,
  shipping: LEGAL_UPDATED,
  accessibility: A11Y_REVIEWED,
};

type RichTranslate = {
  rich: (key: string, values: Record<string, string | number | ((chunks: ReactNode) => ReactNode)>) => ReactNode;
};

// A legal or policy page: title, last-updated date, a jump list and the sections of src/data/pilgrim/legal.ts.
// All wording comes from messages (pilgrim.legal.<page>), with the shop's real figures filled in. Paragraphs and
// items may use <mail>...</mail> for a link to the site's e-mail address (the accessibility coordinator).
export default async function LegalDocument({ page, locale }: { page: LegalPage; locale: string }) {
  const translate = await getTranslations();
  const t = translate as unknown as Translate;
  const rich = translate as unknown as RichTranslate;
  const format = await getFormatter();
  const updated = format.dateTime(new Date(`${UPDATED[page]}T12:00:00Z`), { dateStyle: 'long', timeZone: 'UTC', numberingSystem: 'latn' });
  const values = { ...faqValues(locale), date: updated };
  const text = (key: string) => t(`pilgrim.legal.${page}.${key}`, values);
  const richText = (key: string) =>
    rich.rich(`pilgrim.legal.${page}.${key}`, {
      ...values,
      mail: (chunks) => (
        <a href={`mailto:${CONTACT_EMAIL}`} className="ui-link ui-ltr">
          {chunks}
        </a>
      ),
    });

  const jsonLd = [
    webPageJsonLd(locale, {
      path: PATH[page],
      name: text('meta.title'),
      description: text('meta.description'),
      extra: { dateModified: UPDATED[page] },
    }),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t(`pilgrim.nav.${NAV_KEY[page]}`), path: PATH[page] },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PageHero
        eyebrow={t('pilgrim.legal.eyebrow')}
        title={text('title')}
        lead={text('lead')}
        media={getMedia('souk-vaulted-alley')}
      />

      <section className="ui-section">
        <div className="ui-container">
          <p className={shared.updated}>
            {t('pilgrim.legal.updated', { date: updated })}
          </p>
          <nav aria-label={t('pilgrim.legal.contents')}>
            <ul className={shared.toc}>
              {LEGAL[page].map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{text(`sections.${section.id}.title`)}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={shared.prose}>
            {LEGAL[page].map((section) => (
              <section key={section.id} aria-labelledby={`${section.id}-title`}>
                <h2 id={section.id}>
                  <span id={`${section.id}-title`}>{text(`sections.${section.id}.title`)}</span>
                </h2>
                {section.paras?.map((p) => (
                  <p key={p}>{richText(`sections.${section.id}.${p}`)}</p>
                ))}
                {section.items && (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{richText(`sections.${section.id}.items.${item}`)}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <h2 id="related">{t('pilgrim.legal.related')}</h2>
            <ul>
              {legalNav
                .filter((item) => item.key !== NAV_KEY[page])
                .map((item) => (
                  <li key={item.key}>
                    <Link href={item.href}>{t(`pilgrim.nav.${item.key}`)}</Link>
                  </li>
                ))}
              <li>
                <Link href="/contact">{t('pilgrim.nav.contact')}</Link>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
