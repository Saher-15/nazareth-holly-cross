import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowIcon } from '@/components/places/icons';
import Reveal from '@/components/ui/Reveal';
import shared from './shared.module.css';

export type PilgrimPage = 'plan' | 'visit' | 'gospel' | 'gallery' | 'prayers' | 'contact';

const HREF: Record<PilgrimPage, string> = {
  plan: '/plan',
  visit: '/visit',
  gospel: '/gospel',
  gallery: '/gallery',
  prayers: '/prayers',
  contact: '/contact',
};

// "Continue the journey": cards linking to other pilgrim pages, so every page leads to the next useful one.
export default async function NextSteps({ pages }: { pages: readonly PilgrimPage[] }) {
  const t = await getTranslations('pilgrim');
  return (
    <section className="ui-section" aria-labelledby="next-steps-title" data-noprint>
      <div className="ui-container">
        <Reveal as="header" className={shared.head}>
          <p className="ui-eyebrow">{t('common.moreEyebrow')}</p>
          <h2 id="next-steps-title" className="ui-h2">
            {t('common.moreTitle')}
          </h2>
        </Reveal>
        <ul className={shared.cards}>
          {pages.map((page, i) => (
            <Reveal as="li" key={page} className={`ui-glass ui-card ${shared.card}`} delay={i * 80}>
              <h3 className="ui-h3">{t(`nav.${page}`)}</h3>
              <p className={shared.cardMuted}>{t(`${page}.meta.description`)}</p>
              <Link href={HREF[page]} className={shared.cardLink}>
                {t('common.open')}
                <ArrowIcon size={16} className={shared.arrow} />
                <span className="visually-hidden">{t(`nav.${page}`)}</span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
