import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { breadcrumbJsonLd } from '@/data/places/seo';
import { faqValues, type Translate } from '@/data/pilgrim/faqEntries';
import { LEGAL, type LegalPage } from '@/data/pilgrim/legal';
import { webPageJsonLd } from '@/data/pilgrim/seo';
import { legalNav } from '@/lib/site';
import JsonLd from '@/components/places/JsonLd';
import PageHero from '@/components/ui/PageHero';
import shared from './shared.module.css';

/** When the legal texts were last revised (YYYY-MM-DD). Update it with every change to the messages. */
export const LEGAL_UPDATED = '2026-10-05';

const PATH: Record<LegalPage, string> = { privacy: '/privacy', terms: '/terms', shipping: '/shipping-returns' };
const NAV_KEY: Record<LegalPage, string> = { privacy: 'privacy', terms: 'terms', shipping: 'shipping' };

// A legal or policy page: title, last-updated date, a jump list and the sections of src/data/pilgrim/legal.ts.
// All wording comes from messages (pilgrim.legal.<page>), with the shop's real figures filled in.
export default async function LegalDocument({ page, locale }: { page: LegalPage; locale: string }) {
  const t = (await getTranslations()) as Translate;
  const format = await getFormatter();
  const values = faqValues(locale);
  const text = (key: string) => t(`pilgrim.legal.${page}.${key}`, values);

  const jsonLd = [
    webPageJsonLd(locale, {
      path: PATH[page],
      name: text('meta.title'),
      description: text('meta.description'),
      extra: { dateModified: LEGAL_UPDATED },
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
        image="/images/vitrage-bg.jpg"
      />

      <section className="ui-section">
        <div className="ui-container">
          <p className={shared.updated}>
            {t('pilgrim.legal.updated', {
              date: format.dateTime(new Date(`${LEGAL_UPDATED}T12:00:00Z`), { dateStyle: 'long', timeZone: 'UTC' }),
            })}
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
                  <p key={p}>{text(`sections.${section.id}.${p}`)}</p>
                ))}
                {section.items && (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{text(`sections.${section.id}.items.${item}`)}</li>
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
