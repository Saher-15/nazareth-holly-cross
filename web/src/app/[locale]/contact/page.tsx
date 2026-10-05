import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { photo } from '@/data/places/places';
import { breadcrumbJsonLd, contactPointJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { whatsappUrl } from '@/data/pilgrim/contact';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from '@/lib/config';
import { socialLinks } from '@/lib/site';
import JsonLd from '@/components/ui/JsonLd';
import PlaceHero from '@/components/places/PlaceHero';
import ContactForm from '@/components/pilgrim/ContactForm';
import NextSteps from '@/components/pilgrim/NextSteps';
import Reveal from '@/components/ui/Reveal';
import styles from './page.module.css';

const HERO = photo('greek', 10);

export async function generateMetadata({ params }: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'contact', '/contact', HERO);
}

// /contact: the form (posted to the API from the browser) next to the other ways to reach us.
export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const whatsapp = whatsappUrl(CONTACT_WHATSAPP);

  const jsonLd = [
    webPageJsonLd(locale, {
      type: 'ContactPage',
      path: '/contact',
      name: t('pilgrim.contact.meta.title'),
      description: t('pilgrim.contact.meta.description'),
      extra: { mainEntity: contactPointJsonLd(t('site.name')) },
    }),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('pilgrim.nav.contact'), path: '/contact' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={HERO}
        size="medium"
        eyebrow={t('pilgrim.contact.hero.eyebrow')}
        title={t('pilgrim.contact.hero.title')}
        lead={t('pilgrim.contact.hero.lead')}
      />

      <section className="ui-section">
        <div className={`ui-container ${styles.layout}`}>
          <Reveal>
            <ContactForm titleId="contact-form-title" />
          </Reveal>

          <Reveal as="aside" className={`ui-glass ui-card ${styles.direct}`} delay={80}>
            <h2 className="ui-h3">{t('pilgrim.contact.direct.title')}</h2>
            <p className={styles.text}>{t('pilgrim.contact.direct.text')}</p>
            <ul className={styles.channels}>
              <li>
                <a className={`ui-btn ui-btn--gold ${styles.channel}`} href={`mailto:${CONTACT_EMAIL}`}>
                  {t('pilgrim.contact.direct.email')}
                </a>
                <span className={styles.address} dir="ltr">
                  {CONTACT_EMAIL}
                </span>
              </li>
              {whatsapp && (
                <li>
                  <a
                    className={`ui-btn ui-btn--glass ${styles.channel}`}
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('pilgrim.contact.direct.whatsapp')}
                    <span className="visually-hidden"> {t('placesPage.newTab')}</span>
                  </a>
                </li>
              )}
            </ul>
            <h3 className={styles.sub}>{t('site.footer.follow')}</h3>
            <ul className={styles.social}>
              {socialLinks.map((s) => (
                <li key={s.name}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer">
                    {s.name}
                    <span className="visually-hidden"> {t('placesPage.newTab')}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className={styles.small}>{t('pilgrim.contact.direct.reply')}</p>
          </Reveal>
        </div>
      </section>

      <NextSteps pages={['visit', 'plan', 'prayers']} />
    </div>
  );
}
