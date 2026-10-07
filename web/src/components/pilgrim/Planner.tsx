'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { directionsUrl, getPlace, placeHref, type PlaceSlug } from '@/data/places/places';
import { RouteIcon } from '@/components/ui/icons';
import { addDays, buildIcs, saveIcsFile, type IcsEvent } from '@/data/pilgrim/ics';
import {
  buildItinerary,
  clockDate,
  INTERESTS,
  MAX_DAYS,
  MIN_DAYS,
  PACES,
  parsePlan,
  planToSearch,
  STOPS_PER_DAY,
  type Interest,
  type Pace,
  type PlanInput,
} from '@/data/pilgrim/plan';
import { replaceQueryString, useQueryString } from '@/lib/urlState';
import styles from './Planner.module.css';

const DAY_OPTIONS = Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => MIN_DAYS + i);

/** Today plus one day, as the visitor's local calendar date (YYYY-MM-DD). */
function tomorrow(): string {
  const d = new Date(Date.now() + 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The pilgrimage planner: three questions on one side, the day-by-day itinerary on the other. The answers live in
// the URL (?days=2&interests=gospel&pace=full), so a plan is shareable and survives a reload; the itinerary can
// be printed or saved to a calendar as a .ics file made right here in the browser.
export default function Planner() {
  const t = useTranslations('pilgrim.plan');
  const tAll = useTranslations();
  const format = useFormatter();
  const search = useQueryString();
  const plan = useMemo(() => parsePlan(search), [search]);
  const itinerary = useMemo(() => buildItinerary(plan), [plan]);
  const [notice, setNotice] = useState('');

  const update = (next: Partial<PlanInput>) => replaceQueryString(planToSearch({ ...plan, ...next }));
  const toggle = (interest: Interest) =>
    update({
      interests: plan.interests.includes(interest)
        ? plan.interests.filter((i) => i !== interest)
        : INTERESTS.filter((i) => i === interest || plan.interests.includes(i)),
    });

  const clock = (minutes: number) =>
    format.dateTime(clockDate(minutes), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  const dayDate = (index: number) =>
    plan.start
      ? format.dateTime(new Date(`${addDays(plan.start, index)}T12:00:00Z`), { dateStyle: 'full', timeZone: 'UTC' })
      : null;
  const placeName = (slug: PlaceSlug) => tAll(getPlace(slug)!.nameKey);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: t('shareTitle'), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice(t('copied'));
    } catch {
      // Closing the share sheet rejects; a blocked clipboard has nothing more to offer than the address bar.
    }
  }

  function downloadCalendar() {
    const first = plan.start || tomorrow();
    const events: IcsEvent[] = [];
    for (const day of itinerary.days) {
      const date = addDays(first, day.number - 1);
      for (const item of day.items) {
        if (item.kind === 'lunch') {
          events.push({
            uid: `lunch-${day.number}-${item.start}@nazarethholycross.com`,
            date,
            start: item.start,
            end: item.end,
            summary: t('lunch'),
            location: t('calendarLocation'),
          });
          continue;
        }
        const place = getPlace(item.slug)!;
        events.push({
          uid: `${item.slug}-${day.number}-${item.start}@nazarethholycross.com`,
          date,
          start: item.start,
          end: item.end,
          summary: placeName(item.slug),
          description: `${t(`tips.${item.slug}`)}\n${t('caveat.hours')}`,
          location: `${placeName(item.slug)}, ${t('calendarLocation')}`,
          geo: place.geo,
        });
      }
    }
    saveIcsFile(buildIcs(events, { name: t('calendarName') }), 'nazareth-pilgrimage.ics');
    setNotice(t('calendarDone'));
  }

  return (
    <div className={styles.layout}>
      <form className={`ui-glass ${styles.form}`} onSubmit={(e) => e.preventDefault()} data-noprint>
        <h2 className={styles.formTitle}>{t('form.title')}</h2>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('form.days')}</legend>
          <div className={styles.segments}>
            {DAY_OPTIONS.map((n) => (
              <label key={n} className={styles.segment}>
                <input type="radio" name="days" value={n} checked={plan.days === n} onChange={() => update({ days: n })} />
                <span>{n}</span>
                <span className="visually-hidden">{t('form.dayCount', { count: n })}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('form.interests')}</legend>
          <p className={styles.hint}>{t('form.interestsHint')}</p>
          <div className={styles.chips}>
            {INTERESTS.map((interest) => (
              <label key={interest} className={styles.chip}>
                <input
                  type="checkbox"
                  name="interests"
                  value={interest}
                  checked={plan.interests.includes(interest)}
                  onChange={() => toggle(interest)}
                />
                <span>{t(`form.interest.${interest}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('form.pace')}</legend>
          <div className={styles.paces}>
            {PACES.map((pace: Pace) => (
              <label key={pace} className={styles.pace}>
                <input type="radio" name="pace" value={pace} checked={plan.pace === pace} onChange={() => update({ pace })} />
                <span className={styles.paceName}>{t(`form.paces.${pace}`)}</span>
                <span className={styles.paceHint}>{t('form.paceHint', { count: STOPS_PER_DAY[pace] })}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="ui-field">
          <label className="ui-label" htmlFor="plan-start">
            {t('form.start')}
          </label>
          <input
            id="plan-start"
            type="date"
            className="ui-input"
            value={plan.start}
            onChange={(e) => update({ start: e.target.value })}
            aria-describedby="plan-start-hint"
          />
          <p id="plan-start-hint" className={styles.hint}>
            {t('form.startHint')}
          </p>
        </div>
      </form>

      <div className={styles.result}>
        <header className={styles.resultHead}>
          <div>
            <h2 className={styles.resultTitle}>{t('result.title')}</h2>
            <p className={styles.summary} aria-live="polite">
              {t('result.summary', {
                days: itinerary.days.length,
                stops: itinerary.stops,
                minutes: itinerary.walkMinutes,
              })}
            </p>
          </div>
          <div className={styles.actions} data-noprint>
            <button type="button" className="ui-btn ui-btn--gold" onClick={downloadCalendar}>
              {t('actions.calendar')}
            </button>
            <button type="button" className="ui-btn ui-btn--glass" onClick={share}>
              {t('actions.share')}
            </button>
            <button type="button" className="ui-btn ui-btn--glass" onClick={() => window.print()}>
              {t('actions.print')}
            </button>
          </div>
        </header>
        <p className={styles.notice} role="status" data-noprint>
          {notice}
        </p>

        <ol className={styles.days}>
          {itinerary.days.map((day) => (
            <li key={day.number} className={`ui-glass ${styles.day}`}>
              <h3 className={styles.dayTitle}>
                {t('result.day', { n: day.number })}
                {dayDate(day.number - 1) && <span className={styles.dayDate}>{dayDate(day.number - 1)}</span>}
              </h3>
              <ol className={styles.items}>
                {day.items.map((item) => {
                  if (item.kind === 'lunch') {
                    return (
                      <li key={`lunch-${item.start}`} className={`${styles.item} ${styles.lunch}`}>
                        <span className={styles.time}>{clock(item.start)}</span>
                        <div>
                          <p className={styles.itemTitle}>{t('lunch')}</p>
                          <p className={styles.tip}>{t('lunchHint')}</p>
                        </div>
                      </li>
                    );
                  }
                  const place = getPlace(item.slug)!;
                  return (
                    <li key={item.slug} className={styles.item}>
                      {item.walkFromPrevious !== null && (
                        <p className={styles.walk}>{t('result.walk', { minutes: item.walkFromPrevious })}</p>
                      )}
                      <span className={styles.time}>{clock(item.start)}</span>
                      <div>
                        <p className={styles.itemTitle}>
                          <Link href={placeHref(item.slug)}>{placeName(item.slug)}</Link>
                        </p>
                        <p className={styles.meta}>
                          {tAll(`placesPage.kind.${item.slug}`)} · {t('result.until', { time: clock(item.end) })}
                        </p>
                        <p className={styles.tip}>{t(`tips.${item.slug}`)}</p>
                        <a
                          className={styles.directions}
                          href={directionsUrl(place.geo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-noprint
                        >
                          <RouteIcon size={16} />
                          {tAll('placesPage.directions')} <span className="visually-hidden">{tAll('placesPage.newTab')}</span>
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>

        <aside className={`ui-glass ${styles.caveat}`}>
          <h3 className={styles.caveatTitle}>{t('caveat.title')}</h3>
          <ul>
            <li>{t('caveat.hours')}</li>
            <li>{t('caveat.dress')}</li>
            <li>{t('caveat.walking')}</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
