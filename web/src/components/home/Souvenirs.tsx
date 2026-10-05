import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Reveal from '@/components/ui/Reveal';
import { formatUsd } from '@/lib/pricing';
import { loadFeatured, type Featured } from './data';
import styles from './Souvenirs.module.css';

type ViewProps = { id: string; locale: string; featured: Featured };

// Featured products, rendered on the server. When the shop cannot be reached the
// section stays, with a friendly note and the way to the shop; when the shop is
// simply empty the section is left out.
export function SouvenirsView({ id, locale, featured }: ViewProps) {
  const t = useTranslations('home');
  if (featured.ok && featured.products.length === 0) return null;

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <Reveal className="ui-container">
        <header className={styles.head}>
          <p className="ui-eyebrow">{t('shopEyebrow')}</p>
          <h2 id={`${id}-title`} className="ui-h2">
            {t('shopTitle')}
          </h2>
        </header>

        {featured.ok ? (
          <ul className={styles.grid}>
            {featured.products.map((p) => (
              <li key={p._id} className={styles.product}>
                <Link href={`/shop/${p._id}`} className={styles.link}>
                  <span className={styles.imgWrap}>
                    <Image
                      className={styles.img}
                      src={p.img}
                      alt="" /* the name is the link text right below */
                      fill
                      sizes="(min-width: 1180px) 280px, (min-width: 1000px) 24vw, (min-width: 700px) 32vw, 48vw"
                    />
                  </span>
                  {/* names are stored in one language; dir=auto keeps them readable in Hebrew and Arabic */}
                  <span className={styles.name} dir="auto">
                    {p.name}
                  </span>
                  <span className={styles.price}>{formatUsd(p.price, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className={`ui-glass ${styles.fallback}`} data-testid="souvenirs-fallback">
            <p>{t('shopError')}</p>
          </div>
        )}

        <p className={styles.center}>
          <Link href="/shop" className="ui-btn ui-btn--gold">
            {t('shopAll')}
          </Link>
        </p>
      </Reveal>
    </section>
  );
}

export default async function Souvenirs({ id, locale }: Omit<ViewProps, 'featured'>) {
  const featured = await loadFeatured();
  return <SouvenirsView id={id} locale={locale} featured={featured} />;
}
