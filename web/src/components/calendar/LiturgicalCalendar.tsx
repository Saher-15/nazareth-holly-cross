'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronEndIcon, ChevronStartIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import { buildIcs, saveIcsFile } from '@/data/pilgrim/ics';
import { isRtl } from '@/i18n/routing';
import type { CalendarBroadcast } from '@/lib/broadcastSchedule';
import { BROADCAST_DURATION_MS } from '@/lib/time';
import {
  addMonths,
  daysBetween,
  daysInMonth,
  feastDefinition,
  feastsBetween,
  nazarethToday,
  nextFeasts,
  noonUtc,
  parseIsoDate,
  toIsoDate,
  TRADITION_FILTERS,
  type FeastOccurrence,
  type IsoDate,
  type TraditionFilter,
} from '@/lib/liturgical';
import { NAZARETH_TIME_ZONE } from '@/lib/time';
import { broadcastsByDay, monthWeeks, moveByKey, weekdayColumns, weekStartFor } from './calendarModel';
import styles from './LiturgicalCalendar.module.css';

type Props = {
  /** Today in Nazareth when the server rendered the page (the browser takes over after hydration). */
  today: IsoDate;
  broadcasts: readonly CalendarBroadcast[];
  /** The /live page in this language, absolute: the link inside a saved calendar entry. */
  pageUrl: string;
};

/** How many feasts the "upcoming" list shows. */
export const UPCOMING_COUNT = 8;
/** The grid stays inside the years for which the dates are stated (13 days between the calendars until 2099). */
const FIRST_DAY = '1900-01-01';
const LAST_DAY = '2099-12-31';
const clampDay = (date: IsoDate) => (date < FIRST_DAY ? FIRST_DAY : date > LAST_DAY ? LAST_DAY : date);

// ---- today in Nazareth, kept current in the browser (a page left open past midnight moves on) ----
let dayListeners = new Set<() => void>();
let dayTimer: ReturnType<typeof setInterval> | undefined;
function subscribeDay(listener: () => void) {
  dayListeners.add(listener);
  dayTimer ??= setInterval(() => dayListeners.forEach((l) => l()), 60_000);
  return () => {
    dayListeners.delete(listener);
    if (!dayListeners.size && dayTimer !== undefined) {
      clearInterval(dayTimer);
      dayTimer = undefined;
      dayListeners = new Set();
    }
  };
}

const UTC = 'UTC';

// The Christian calendar of the /live page (docs/LITURGICAL-CALENDAR.md): a month grid (a WAI-ARIA grid: one tab
// stop, arrow keys, Home/End, Page Up/Down, mirrored in Hebrew and Arabic), the feasts of the chosen day, the next
// feasts, a filter by tradition, "add to calendar" per feast (an .ics file made in the browser, as the pilgrimage
// planner does), and the broadcasts the team scheduled in the dashboard. Every date is computed in
// web/src/lib/liturgical; nothing is sent anywhere.
export default function LiturgicalCalendar({ today: serverToday, broadcasts, pageUrl }: Props) {
  const t = useTranslations('pilgrim.calendar');
  const locale = useLocale();
  const toast = useToast();
  const rtl = isRtl(locale);
  const today = useSyncExternalStore(subscribeDay, () => nazarethToday(), () => serverToday);
  const [tradition, setTradition] = useState<TraditionFilter>('all');
  const [active, setActive] = useState<IsoDate>(serverToday);
  const grid = useRef<HTMLTableElement>(null);
  const focusAfterRender = useRef(false);

  const weekStart = weekStartFor(locale);
  const { year, month } = parseIsoDate(active);
  const weeks = useMemo(() => monthWeeks(year, month, weekStart), [year, month, weekStart]);
  const broadcastDays = useMemo(() => broadcastsByDay(broadcasts), [broadcasts]);
  const monthFeasts = useMemo(() => {
    const byDay = new Map<IsoDate, FeastOccurrence[]>();
    const first = toIsoDate({ year, month, day: 1 });
    const last = toIsoDate({ year, month, day: daysInMonth(year, month) });
    for (const occurrence of feastsBetween(first, last, tradition)) byDay.set(occurrence.date, [...(byDay.get(occurrence.date) ?? []), occurrence]);
    return byDay;
  }, [year, month, tradition]);
  const upcoming = useMemo(() => nextFeasts(today, UPCOMING_COUNT, tradition), [today, tradition]);

  const format = useMemo(() => {
    const make = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { numberingSystem: 'latn', ...options });
    const monthTitle = make({ month: 'long', year: 'numeric', timeZone: UTC });
    const full = make({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: UTC });
    const dayMonth = make({ day: 'numeric', month: 'long', timeZone: UTC });
    const short = make({ weekday: 'short', timeZone: UTC });
    const narrow = make({ weekday: 'narrow', timeZone: UTC });
    const long = make({ weekday: 'long', timeZone: UTC });
    const monthShort = make({ month: 'short', timeZone: UTC });
    const time = make({ hour: 'numeric', minute: '2-digit', timeZone: NAZARETH_TIME_ZONE });
    const list = new Intl.ListFormat(locale, { type: 'conjunction', style: 'long' });
    // A Sunday: 4 January 1970 (weekday 0), so `sunday + n` is weekday n.
    const weekdayDate = (n: number) => new Date(Date.UTC(1970, 0, 4 + n, 12));
    return {
      month: (date: IsoDate) => monthTitle.format(noonUtc(date)),
      full: (date: IsoDate) => full.format(noonUtc(date)),
      dayMonth: (date: IsoDate) => dayMonth.format(noonUtc(date)),
      monthShort: (date: IsoDate) => monthShort.format(noonUtc(date)),
      julian: (m: number, d: number) => dayMonth.format(new Date(Date.UTC(2001, m - 1, d, 12))),
      weekday: (n: number) => ({ short: short.format(weekdayDate(n)), narrow: narrow.format(weekdayDate(n)), long: long.format(weekdayDate(n)) }),
      time: (ms: number) => time.format(ms),
      list: (items: string[]) => list.format(items),
    };
  }, [locale]);

  useEffect(() => {
    if (!focusAfterRender.current) return;
    focusAfterRender.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`button[data-date="${active}"]`)?.focus();
  }, [active]);

  const feastName = (o: FeastOccurrence) =>
    o.traditions.length === 1 && o.traditions[0] === 'orthodox' && feastDefinition(o.id).orthodoxName ? t(`feasts.${o.id}.orthodoxName`) : t(`feasts.${o.id}.name`);
  const traditionLabel = (o: FeastOccurrence) => (o.traditions.length > 1 ? t('tradition.both') : t(`tradition.${o.traditions[0]}`));
  const feastNote = (o: FeastOccurrence) =>
    o.transferredFrom
      ? t('day.transferred', { date: format.dayMonth(o.transferredFrom) })
      : o.julian
        ? t('day.julian', { date: format.julian(o.julian.month, o.julian.day) })
        : '';

  const dayLabel = (date: IsoDate) => {
    const events = [
      ...(monthFeasts.get(date) ?? []).map((o) => t('day.feast', { name: feastName(o), tradition: traditionLabel(o) })),
      ...(broadcastDays.get(date) ?? []).map((b) => t('day.broadcast', { time: format.time(b.start), title: b.title })),
    ];
    return events.length ? t('day.events', { date: format.full(date), events: format.list(events) }) : format.full(date);
  };

  const go = (date: IsoDate, focus = false) => {
    focusAfterRender.current = focus;
    setActive(clampDay(date));
  };

  const onDayKey = (event: KeyboardEvent<HTMLButtonElement>, date: IsoDate) => {
    const next = moveByKey(date, event.key, { rtl, weekStart, shift: event.shiftKey });
    if (!next) return;
    event.preventDefault();
    go(next, true);
  };

  const addFeast = (o: FeastOccurrence) => {
    const name = feastName(o);
    const ics = buildIcs(
      [
        {
          uid: `${o.id}-${o.traditions.join('-')}-${o.date}@nazarethholycross.com`,
          allDay: true,
          date: o.date,
          summary: t('day.feast', { name, tradition: traditionLabel(o) }),
          description: [t(`feasts.${o.id}.description`), feastNote(o)].filter(Boolean).join('\n'),
          location: t('ics.location'),
          url: `${pageUrl}#calendar`,
        },
      ],
      { name: t('ics.calendarName'), product: 'Christian calendar' },
    );
    saveIcsFile(ics, `${o.id}-${o.date}.ics`);
    toast.show({ message: t('ics.saved', { name }), kind: 'success' });
  };

  const addBroadcast = (b: CalendarBroadcast) => {
    const ics = buildIcs(
      [
        {
          uid: `broadcast-${b.id}@nazarethholycross.com`,
          startsAt: b.start,
          endsAt: b.start + BROADCAST_DURATION_MS,
          summary: b.title,
          description: b.description,
          url: pageUrl,
        },
      ],
      { name: t('ics.calendarName'), product: 'Christian calendar' },
    );
    saveIcsFile(ics, `broadcast-${b.startsAt.slice(0, 10)}.ics`);
    toast.show({ message: t('ics.saved', { name: b.title }), kind: 'success' });
  };

  const badges = (o: FeastOccurrence) => (
    <span className={styles.badges}>
      {o.traditions.map((tr) => (
        <span key={tr} className={`${styles.badge} ${tr === 'catholic' ? styles.badgeCatholic : styles.badgeOrthodox}`}>
          <span className={`${styles.shape} ${tr === 'catholic' ? styles.dotCatholic : styles.dotOrthodox}`} aria-hidden="true" />
          {t(`tradition.${tr}`)}
        </span>
      ))}
      {o.nazareth && (
        <span className={`${styles.badge} ${styles.badgeNazareth}`}>
          <NazarethMark className={styles.badgeMark} />
          {t('legend.nazareth')}
        </span>
      )}
    </span>
  );

  const addButton = (name: string, onClick: () => void) => (
    <button type="button" className={styles.add} onClick={onClick} aria-label={t('ics.addNamed', { name })}>
      <CalendarPlusIcon />
      {t('ics.add')}
    </button>
  );

  const columns = weekdayColumns(weekStart);
  const monthTitle = format.month(active);
  const dayFeasts = monthFeasts.get(active) ?? [];
  const dayBroadcasts = broadcastDays.get(active) ?? [];
  const atStart = active.slice(0, 7) === FIRST_DAY.slice(0, 7);
  const atEnd = active.slice(0, 7) === LAST_DAY.slice(0, 7);
  const monthPrefix = active.slice(0, 7);
  // What happens this month, in date order: the list beside the grid (and its alternative for every visitor).
  const monthEvents: { date: IsoDate; key: string; feast?: FeastOccurrence; broadcast?: CalendarBroadcast }[] = [
    ...[...monthFeasts.values()].flat().map((o) => ({ date: o.date, key: `f-${o.id}-${o.traditions.join()}`, feast: o })),
    ...[...broadcastDays.entries()]
      .filter(([date]) => date.startsWith(monthPrefix))
      .flatMap(([date, list]) => list.map((b) => ({ date, key: `b-${b.id}`, broadcast: b }))),
  ].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  // A month without feasts points to the next one.
  const nextAfterMonth = monthEvents.length ? undefined : nextFeasts(addMonths(`${monthPrefix}-01`, 1), 1, tradition)[0];

  return (
    <div className={styles.calendar} data-testid="liturgical-calendar">
      <fieldset className={styles.filter}>
        <legend className={styles.filterLegend}>{t('filter.legend')}</legend>
        <div className={styles.segments}>
          {TRADITION_FILTERS.map((value) => (
            <label key={value} className={styles.segment}>
              <input type="radio" name="calendar-tradition" value={value} checked={tradition === value} onChange={() => setTradition(value)} />
              <span>
                {value !== 'all' && <span className={`${styles.shape} ${value === 'catholic' ? styles.dotCatholic : styles.dotOrthodox}`} aria-hidden="true" />}
                {t(`filter.${value}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.layout}>
        <div className={`ui-glass ${styles.monthCard}`}>
          <div className={styles.monthBar}>
            <h3 id="calendar-month" className={styles.monthTitle} aria-live="polite" suppressHydrationWarning>
              {monthTitle}
            </h3>
            <div className={styles.monthNav}>
              <button type="button" className={`ui-btn ui-btn--glass ui-btn--sm ${styles.todayButton}`} onClick={() => go(today)}>
                {t('month.today')}
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--icon"
                onClick={() => !atStart && go(addMonths(active, -1))}
                aria-label={t('month.previous')}
                aria-disabled={atStart || undefined}
              >
                <ChevronStartIcon flip />
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--icon"
                onClick={() => !atEnd && go(addMonths(active, 1))}
                aria-label={t('month.next')}
                aria-disabled={atEnd || undefined}
              >
                <ChevronEndIcon flip />
              </button>
            </div>
          </div>

          <p id="calendar-keys" className="visually-hidden">
            {t('month.hint')}
          </p>
          <table ref={grid} role="grid" className={styles.grid} aria-labelledby="calendar-month" aria-describedby="calendar-keys">
            <thead>
              <tr>
                {columns.map((n) => {
                  const name = format.weekday(n);
                  return (
                    <th key={n} scope="col" className={styles.weekday}>
                      <span className={styles.short} aria-hidden="true" suppressHydrationWarning>
                        {name.short}
                      </span>
                      <span className={styles.narrow} aria-hidden="true" suppressHydrationWarning>
                        {name.narrow}
                      </span>
                      <span className="visually-hidden" suppressHydrationWarning>
                        {name.long}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, w) => (
                <tr key={week.find(Boolean) ?? w}>
                  {week.map((date, i) => {
                    if (!date) return <td key={`empty-${i}`} role="gridcell" className={styles.empty} />;
                    const feasts = monthFeasts.get(date) ?? [];
                    const has = (tr: 'catholic' | 'orthodox') => feasts.some((o) => o.traditions.includes(tr));
                    const nazareth = feasts.some((o) => o.nazareth);
                    const onAir = broadcastDays.has(date);
                    const selected = date === active;
                    return (
                      <td key={date} role="gridcell" aria-selected={selected} className={styles.cell}>
                        <button
                          type="button"
                          className={[styles.day, selected && styles.selected, date === today && styles.today, nazareth && styles.nazarethDay, feasts.length > 0 && styles.feastDay]
                            .filter(Boolean)
                            .join(' ')}
                          tabIndex={selected ? 0 : -1}
                          data-date={date}
                          aria-label={dayLabel(date)}
                          aria-current={date === today ? 'date' : undefined}
                          onClick={() => go(date)}
                          onKeyDown={(event) => onDayKey(event, date)}
                          suppressHydrationWarning
                        >
                          <span className={styles.number} aria-hidden="true">
                            {parseIsoDate(date).day}
                          </span>
                          <span className={styles.marks} aria-hidden="true">
                            {has('catholic') && <span className={`${styles.shape} ${styles.dotCatholic}`} />}
                            {has('orthodox') && <span className={`${styles.shape} ${styles.dotOrthodox}`} />}
                            {onAir && <span className={`${styles.shape} ${styles.dotBroadcast}`} />}
                          </span>
                          {nazareth && <NazarethMark className={styles.cornerMark} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <ul className={styles.legend} aria-label={t('legend.title')}>
            <li>
              <span className={`${styles.shape} ${styles.dotCatholic}`} aria-hidden="true" />
              {t('legend.catholic')}
            </li>
            <li>
              <span className={`${styles.shape} ${styles.dotOrthodox}`} aria-hidden="true" />
              {t('legend.orthodox')}
            </li>
            <li>
              <NazarethMark className={styles.legendMark} />
              {t('legend.nazareth')}
            </li>
            {broadcasts.length > 0 && (
              <li>
                <span className={`${styles.shape} ${styles.dotBroadcast}`} aria-hidden="true" />
                {t('legend.broadcast')}
              </li>
            )}
            <li>
              <span className={styles.todaySwatch} aria-hidden="true" />
              {t('legend.today')}
            </li>
          </ul>
        </div>

        <div className={`ui-glass ${styles.dayCard}`}>
          <div className={styles.dayPanel} data-testid="calendar-day">
            <h4 className={styles.dayTitle}>
              <time dateTime={active} suppressHydrationWarning>
                {format.full(active)}
              </time>
              {active === today && <span className={styles.todayTag}>{t('day.today')}</span>}
            </h4>
            {dayFeasts.length === 0 && dayBroadcasts.length === 0 ? (
              <p className={styles.none}>{t('day.none')}</p>
            ) : (
              <ul className={styles.dayList}>
                {dayFeasts.map((o) => (
                  <li key={`${o.id}-${o.traditions.join()}`} className={styles.entry}>
                    <FeastBody name={feastName(o)} description={t(`feasts.${o.id}.description`)} note={feastNote(o)} nazareth={o.nazareth}>
                      {badges(o)}
                      {addButton(feastName(o), () => addFeast(o))}
                    </FeastBody>
                  </li>
                ))}
                {dayBroadcasts.map((b) => (
                  <li key={b.id} className={styles.entry}>
                    <div className={styles.body}>
                      <p className={styles.entryName} dir="auto">
                        {b.title}
                      </p>
                      <p className={styles.entryMeta}>
                        <time dateTime={b.startsAt} suppressHydrationWarning>
                          {t('day.broadcastTime', { time: format.time(b.start) })}
                        </time>
                      </p>
                      {b.description && (
                        <p className={styles.entryText} dir="auto">
                          {b.description}
                        </p>
                      )}
                      <span className={styles.footer}>
                        <span className={styles.badges}>
                          <span className={`${styles.badge} ${styles.badgeBroadcast}`}>
                            <span className={`${styles.shape} ${styles.dotBroadcast}`} aria-hidden="true" />
                            {t('broadcast.badge')}
                          </span>
                        </span>
                        {addButton(b.title, () => addBroadcast(b))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.monthList}>
            <h4 id="calendar-month-list" className={styles.monthListTitle} suppressHydrationWarning>
              {t('month.list', { month: monthTitle })}
            </h4>
            {monthEvents.length === 0 ? (
              <>
                <p className={styles.none}>{t('month.empty')}</p>
                {nextAfterMonth && (
                  <button type="button" className={`${styles.monthItem} ${styles.nextFeast}`} onClick={() => go(nextAfterMonth.date)}>
                    <span className={styles.monthItemName}>{t('month.nextFeast', { name: feastName(nextAfterMonth) })}</span>
                    <span className={styles.monthItemDate} suppressHydrationWarning>
                      {format.full(nextAfterMonth.date)}
                    </span>
                  </button>
                )}
              </>
            ) : (
              <ul aria-labelledby="calendar-month-list" data-testid="calendar-month-list">
                {monthEvents.map((event) => {
                  const name = event.feast ? feastName(event.feast) : event.broadcast!.title;
                  const tradition = event.feast ? traditionLabel(event.feast) : t('broadcast.badge');
                  return (
                    <li key={event.key}>
                      <button type="button" className={`${styles.monthItem} ${event.date === active ? styles.monthItemActive : ''}`} onClick={() => go(event.date)}>
                        <span className={styles.monthItemDate} suppressHydrationWarning>
                          {format.dayMonth(event.date)}
                        </span>
                        <span className={styles.monthItemName} dir={event.broadcast ? 'auto' : undefined}>
                          {name}
                          <span className="visually-hidden"> ({tradition})</span>
                        </span>
                        <span className={styles.marks} aria-hidden="true">
                          {event.feast?.traditions.includes('catholic') && <span className={`${styles.shape} ${styles.dotCatholic}`} />}
                          {event.feast?.traditions.includes('orthodox') && <span className={`${styles.shape} ${styles.dotOrthodox}`} />}
                          {event.broadcast && <span className={`${styles.shape} ${styles.dotBroadcast}`} />}
                          {event.feast?.nazareth && <NazarethMark className={styles.legendMark} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className={styles.upcomingBlock}>
        <h3 id="calendar-upcoming" className={`ui-h3 ${styles.upcomingTitle}`}>
          {t('upcoming.title')}
        </h3>
        <ol className={styles.upcoming} aria-labelledby="calendar-upcoming" data-testid="calendar-upcoming">
          {upcoming.map((o) => {
            const days = daysBetween(today, o.date);
            return (
              <li key={`${o.id}-${o.date}-${o.traditions.join()}`} className={`ui-glass ${styles.item} ${o.nazareth ? styles.itemNazareth : ''}`}>
                <FeastBody
                  name={feastName(o)}
                  description={t(`feasts.${o.id}.description`)}
                  note={feastNote(o)}
                  nazareth={o.nazareth}
                  aside={
                    <span className={styles.dateBox} aria-hidden="true">
                      <span className={styles.dateDay}>{parseIsoDate(o.date).day}</span>
                      <span className={styles.dateMonth} suppressHydrationWarning>
                        {format.monthShort(o.date)}
                      </span>
                    </span>
                  }
                  when={
                    <>
                      <time className={styles.metaLine} dateTime={o.date} suppressHydrationWarning>
                        {format.full(o.date)}
                      </time>
                      <span className={`${styles.metaLine} ${styles.countdown}`}>{t('upcoming.countdown', { days })}</span>
                    </>
                  }
                >
                  {badges(o)}
                  {addButton(feastName(o), () => addFeast(o))}
                </FeastBody>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function FeastBody({
  name,
  description,
  note,
  when,
  aside,
  nazareth,
  children,
}: {
  name: string;
  description: string;
  note: string;
  when?: ReactNode;
  /** Shown beside the name (the date box of the upcoming list). */
  aside?: ReactNode;
  nazareth: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.body}>
      <div className={styles.bodyHead}>
        {aside}
        <div className={styles.bodyTitle}>
          <p className={`${styles.entryName} ${nazareth ? styles.entryNazareth : ''}`}>{name}</p>
          {when && <p className={styles.entryMeta}>{when}</p>}
        </div>
      </div>
      <p className={styles.entryText}>{description}</p>
      {note && (
        // (The note holds a date written by Intl, which the server and the browser may spell a little differently.)
        <p className={styles.entryNote} suppressHydrationWarning>
          {note}
        </p>
      )}
      <span className={styles.footer}>{children}</span>
    </div>
  );
}

/** The mark of Nazareth's own feasts: a small cross (drawn, decorative). */
function NazarethMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true" focusable="false">
      <path d="M6 1.2v9.6M2.6 4.2h6.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** A calendar page with a plus: "add to calendar" (24px grid, the stroke of the site's icon set). */
function CalendarPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
    </svg>
  );
}
