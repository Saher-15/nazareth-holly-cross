import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Reveal from '@/components/ui/Reveal';
import { walkMinutes } from '@/data/pilgrim/plan';
import { PLACES } from '@/data/places/places';
import { ChevronEnd } from './icons';
import styles from './SitesMap.module.css';

// A small drawn map of the five holy sites, placed by their real coordinates (data/places), with the walking times the
// planner uses. No map service and no tiles: an inline SVG, so nothing leaves the site. The drawing is decorative; the
// numbered list next to it carries the same content for everyone.

const WIDTH = 400;
const HEIGHT = 300;
const PAD = 44;

/** Equirectangular projection of the sites into the drawing (good enough over a few hundred metres). */
function project() {
  const lats = PLACES.map((p) => p.geo.lat);
  const lngs = PLACES.map((p) => p.geo.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180); // a degree of longitude is shorter than one of latitude
  const spanX = (Math.max(...lngs) - Math.min(...lngs)) * kx;
  const spanY = Math.max(...lats) - Math.min(...lats);
  const scale = Math.min((WIDTH - 2 * PAD) / spanX, (HEIGHT - 2 * PAD) / spanY); // drawing units per degree
  const offsetX = (WIDTH - spanX * scale) / 2;
  const offsetY = (HEIGHT - spanY * scale) / 2;
  const points = PLACES.map((p) => ({
    slug: p.slug,
    x: offsetX + (p.geo.lng - Math.min(...lngs)) * kx * scale,
    y: offsetY + (Math.max(...lats) - p.geo.lat) * scale,
  }));
  const metresPerUnit = 111_320 / scale; // one degree of latitude is about 111.32 km
  return { points, metresPerUnit };
}

const { points, metresPerUnit } = project();
const SCALE_METRES = 200;
const scaleLength = SCALE_METRES / metresPerUnit;
const START = 'latin' as const;

export default function SitesMap({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const metres = new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter', unitDisplay: 'short', numberingSystem: 'latn' });

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <Reveal className={`ui-container ${styles.inner}`}>
        <div className={`ui-glass ${styles.mapCard}`}>
          <svg className={styles.map} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
            <g className={styles.grid}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <line key={`v${i}`} x1={(WIDTH / 8) * i} y1={0} x2={(WIDTH / 8) * i} y2={HEIGHT} />
              ))}
              {[1, 2, 3, 4, 5].map((i) => (
                <line key={`h${i}`} x1={0} y1={(HEIGHT / 6) * i} x2={WIDTH} y2={(HEIGHT / 6) * i} />
              ))}
            </g>
            <g className={styles.north} transform={`translate(${WIDTH - 30} 34)`}>
              <path d="M0 -16 L7 6 L0 1 L-7 6 Z" />
              <text y={22} textAnchor="middle">
                {t('home.mapNorth')}
              </text>
            </g>
            <g className={styles.scale} transform={`translate(22 ${HEIGHT - 22})`}>
              <path d={`M0 -5 V0 H${scaleLength} V-5`} />
              <text x={scaleLength / 2} y={-9} textAnchor="middle">
                {metres.format(SCALE_METRES)}
              </text>
            </g>
            {points.map((point, i) => (
              <g key={point.slug} className={point.slug === START ? `${styles.pin} ${styles.start}` : styles.pin} transform={`translate(${point.x} ${point.y})`}>
                <circle r={13} />
                <text y={4.5} textAnchor="middle">
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className={styles.copy}>
          <p className="ui-eyebrow">{t('home.mapEyebrow')}</p>
          <h2 id={`${id}-title`} className="ui-h2">
            {t('home.mapTitle')}
          </h2>
          <p className={styles.text}>{t('home.mapText')}</p>
          <p className={styles.caption} id={`${id}-walk`}>
            {t('home.mapWalk')}
          </p>
          <ol className={styles.legend} aria-describedby={`${id}-walk`}>
            {PLACES.map((place, i) => (
              <li key={place.slug}>
                <span className={styles.number} aria-hidden="true">
                  {i + 1}
                </span>
                <Link href={`/sites/${place.slug}`} className={styles.site}>
                  {t(place.nameKey)}
                  <ChevronEnd className={`ui-flip-rtl ${styles.chevron}`} />
                </Link>
                {place.slug !== START && (
                  <span className={styles.minutes}>{t('pilgrim.plan.walking.minutes', { minutes: walkMinutes(START, place.slug) })}</span>
                )}
              </li>
            ))}
          </ol>
          <p className={styles.actions}>
            <Link href="/plan" className="ui-btn ui-btn--ghost">
              {t('home.mapPlan')}
            </Link>
          </p>
        </div>
      </Reveal>
    </section>
  );
}
