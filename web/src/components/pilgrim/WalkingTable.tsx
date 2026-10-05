import { getTranslations } from 'next-intl/server';
import { PLACES } from '@/data/places/places';
import { walkMinutes } from '@/data/pilgrim/plan';
import shared from './shared.module.css';

// The static table of walking times between the five holy sites (the same numbers the planner uses).
export default async function WalkingTable() {
  const t = await getTranslations();
  return (
    <div className={shared.tableWrap} tabIndex={0} role="region" aria-label={t('pilgrim.plan.walking.title')}>
      <table className={shared.table}>
        <caption>{t('pilgrim.plan.walking.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">{t('pilgrim.plan.walking.corner')}</span>
            </th>
            {PLACES.map((place) => (
              <th key={place.slug} scope="col">
                {t(place.nameKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLACES.map((from) => (
            <tr key={from.slug}>
              <th scope="row">{t(from.nameKey)}</th>
              {PLACES.map((to) => (
                <td key={to.slug} className={from.slug === to.slug ? shared.self : undefined}>
                  {from.slug === to.slug ? '–' : t('pilgrim.plan.walking.minutes', { minutes: walkMinutes(from.slug, to.slug) })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
