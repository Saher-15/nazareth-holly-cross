import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastsByDay, monthWeeks, moveByKey, weekdayColumns, weekStartFor } from '@/components/calendar/calendarModel';
import LiturgicalCalendar, { UPCOMING_COUNT } from '@/components/calendar/LiturgicalCalendar';
import { buildIcs } from '@/data/pilgrim/ics';
import { clearApiMemory } from '@/lib/api';
import {
  broadcastEventsJsonLd,
  loadBroadcastSchedule,
  parseBroadcastSchedule,
  resetBroadcastSchedule,
  type CalendarBroadcast,
} from '@/lib/broadcastSchedule';
import en from '@/messages/en.json';

// The Christian calendar of /live (docs/LITURGICAL-CALENDAR.md): the grid model, the broadcast adapter, the .ics
// entries and the component (keyboard grid, filter, upcoming list, broadcasts, add to calendar).

const { saveIcsFile } = vi.hoisted(() => ({ saveIcsFile: vi.fn() }));
vi.mock('@/data/pilgrim/ics', async (original) => ({ ...(await original<typeof import('@/data/pilgrim/ics')>()), saveIcsFile }));

const cal = en.pilgrim.calendar;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// --------------------------------------------------------------------------------------------- the grid model

describe('the month grid model (calendarModel.ts)', () => {
  it('starts the week on the day each language expects', () => {
    expect(weekStartFor('en')).toBe(0);
    expect(weekStartFor('he')).toBe(0);
    expect(weekStartFor('pt')).toBe(0);
    expect(weekStartFor('ar')).toBe(6);
    for (const locale of ['fr', 'es', 'de', 'it', 'pl', 'ru', 'uk', 'ro', 'nl', 'el']) expect(weekStartFor(locale)).toBe(1);
    expect(weekdayColumns(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayColumns(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });

  it('lays out a month in full weeks with empty cells around it', () => {
    // 1 October 2026 is a Thursday.
    const sunday = monthWeeks(2026, 10, 0);
    expect(sunday).toHaveLength(5);
    expect(sunday[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(sunday[4]).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
    expect(monthWeeks(2026, 10, 1)[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    const saturday = monthWeeks(2026, 10, 6);
    expect(saturday[0].slice(5)).toEqual(['2026-10-01', '2026-10-02']);
    expect(saturday.flat().filter(Boolean)).toHaveLength(31);
    expect(monthWeeks(2026, 2, 0).flat().filter(Boolean)).toHaveLength(28);
    expect(monthWeeks(2024, 2, 0).flat().filter(Boolean)).toHaveLength(29);
    for (const week of monthWeeks(2027, 5, 1)) expect(week).toHaveLength(7);
  });

  it('moves with the keys, Left and Right mirrored right to left', () => {
    const ltr = { rtl: false, weekStart: 0 };
    expect(moveByKey('2026-10-07', 'ArrowRight', ltr)).toBe('2026-10-08');
    expect(moveByKey('2026-10-07', 'ArrowLeft', ltr)).toBe('2026-10-06');
    expect(moveByKey('2026-10-07', 'ArrowRight', { rtl: true, weekStart: 0 })).toBe('2026-10-06');
    expect(moveByKey('2026-10-07', 'ArrowLeft', { rtl: true, weekStart: 0 })).toBe('2026-10-08');
    expect(moveByKey('2026-10-07', 'ArrowDown', ltr)).toBe('2026-10-14');
    expect(moveByKey('2026-10-07', 'ArrowUp', ltr)).toBe('2026-09-30');
    expect(moveByKey('2026-10-07', 'Home', ltr)).toBe('2026-10-04'); // Sunday
    expect(moveByKey('2026-10-07', 'End', ltr)).toBe('2026-10-10'); // Saturday
    expect(moveByKey('2026-10-07', 'Home', { rtl: false, weekStart: 1 })).toBe('2026-10-05'); // Monday
    expect(moveByKey('2026-10-07', 'End', { rtl: true, weekStart: 6 })).toBe('2026-10-09'); // Friday ends an Arabic week
    expect(moveByKey('2026-01-31', 'PageDown', ltr)).toBe('2026-02-28');
    expect(moveByKey('2026-10-07', 'PageUp', { ...ltr, shift: true })).toBe('2025-10-07');
    expect(moveByKey('2026-10-07', 'Enter', ltr)).toBeNull();
    expect(moveByKey('2026-10-07', 'a', ltr)).toBeNull();
  });

  it('puts a broadcast on its day in Nazareth', () => {
    const late = broadcast({ id: 'late', startsAt: '2026-10-20T22:30:00.000Z' }); // 01:30 on the 21st in Nazareth
    const days = broadcastsByDay([late, broadcast({ id: 'a' }), broadcast({ id: 'b', startsAt: '2026-10-20T05:00:00.000Z' })]);
    expect([...days.keys()].sort()).toEqual(['2026-10-20', '2026-10-21']);
    expect(days.get('2026-10-20')?.map((b) => b.id)).toEqual(['a', 'b']);
  });
});

function broadcast(over: Partial<CalendarBroadcast> = {}): CalendarBroadcast {
  const startsAt = over.startsAt ?? '2026-10-20T16:30:00.000Z';
  return { id: 'evening', title: 'Evening prayer', description: 'From the Basilica.', startsAt, start: Date.parse(startsAt), ...over };
}

// ----------------------------------------------------------------------------------- the broadcast adapter

describe('the broadcast schedule adapter (lib/broadcastSchedule.ts)', () => {
  const item = (over: Record<string, unknown> = {}) => ({ id: 'b1', title: 'Rosary', description: 'From Mary’s Well', startsAt: '2026-10-20T16:30:00.000Z', status: 'scheduled', ...over });

  it('reads the API answer ({ items }) and a bare array', () => {
    expect(parseBroadcastSchedule({ timeZone: 'Asia/Jerusalem', items: [item()] })).toEqual([
      { id: 'b1', title: 'Rosary', description: 'From Mary’s Well', startsAt: '2026-10-20T16:30:00.000Z', start: Date.parse('2026-10-20T16:30:00Z') },
    ]);
    expect(parseBroadcastSchedule([item({ status: undefined })])).toHaveLength(1);
  });

  it('leaves out what does not fit, one item at a time, and never throws', () => {
    for (const junk of [null, undefined, 'x', 42, {}, { items: 'no' }, [null], [{}]]) expect(parseBroadcastSchedule(junk)).toEqual([]);
    const list = parseBroadcastSchedule({
      items: [
        item({ id: 'ok', startsAt: '2026-11-01T08:00:00.000Z' }),
        item({ id: 'bad-date', startsAt: 'next Sunday' }),
        item({ id: 'no-title', title: '   ' }),
        item({ id: 'done', status: 'done' }),
        item({ id: 'cancelled', status: 'cancelled' }),
        item({ id: 'ok', title: 'Duplicate' }),
        item({ id: 'earlier', startsAt: '2026-10-25T08:00:00+02:00', description: null }),
        item({ id: 'escaped', title: 'Vespers &amp; Rosary', description: 'Tom &lt;3' }),
      ],
    });
    expect(list.map((b) => b.id)).toEqual(['escaped', 'earlier', 'ok']);
    expect(list[0]).toMatchObject({ title: 'Vespers & Rosary', description: 'Tom <3' });
    expect(list[1]).toMatchObject({ startsAt: '2026-10-25T06:00:00.000Z', description: '' });
  });

  describe('loading on the server', () => {
    beforeEach(() => {
      resetBroadcastSchedule();
      clearApiMemory();
    });

    it('returns the broadcasts the API sends', async () => {
      const fetch = vi.fn(async () => new Response(JSON.stringify({ items: [item()] }), { status: 200, headers: { 'content-type': 'application/json' } }));
      vi.stubGlobal('fetch', fetch);
      expect((await loadBroadcastSchedule()).map((b) => b.id)).toEqual(['b1']);
      expect(String((fetch.mock.calls[0] as unknown[])[0])).toMatch(/\/live\/schedule$/);
    });

    it('an API without the route (404) means no broadcasts, and it is not asked again for a while', async () => {
      const fetch = vi.fn(async () => new Response('{"error":"Not found"}', { status: 404 }));
      vi.stubGlobal('fetch', fetch);
      expect(await loadBroadcastSchedule()).toEqual([]);
      expect(await loadBroadcastSchedule()).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('a network failure or a slow API costs the page at most the deadline', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
      expect(await loadBroadcastSchedule()).toEqual([]);
      resetBroadcastSchedule();
      vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
      const started = Date.now();
      expect(await loadBroadcastSchedule({ deadlineMs: 50 })).toEqual([]);
      expect(Date.now() - started).toBeLessThan(1000);
    });
  });

  it('describes the broadcasts (and only them) as schema.org Events', () => {
    const data = broadcastEventsJsonLd([broadcast()], { locale: 'en', pageUrl: 'https://nazarethholycross.com/en/live', organizer: { '@type': 'Organization', name: 'Nazareth Holy Cross' } });
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Event',
          '@id': 'https://nazarethholycross.com/en/live#broadcast-evening',
          name: 'Evening prayer',
          description: 'From the Basilica.',
          startDate: '2026-10-20T16:30:00.000Z',
          endDate: '2026-10-20T17:30:00.000Z',
          eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
          eventStatus: 'https://schema.org/EventScheduled',
          location: { '@type': 'VirtualLocation', url: 'https://nazarethholycross.com/en/live' },
          organizer: { '@type': 'Organization', name: 'Nazareth Holy Cross' },
          inLanguage: 'en',
        },
      ],
    });
  });
});

// ------------------------------------------------------------------------------------------------ .ics entries

describe('calendar files for feasts and broadcasts (data/pilgrim/ics.ts)', () => {
  const now = new Date('2026-10-07T09:00:00Z');

  it('writes a feast as an all-day event, the same day in every time zone', () => {
    const ics = buildIcs([{ uid: 'holyCross@x', allDay: true, date: '2026-09-27', summary: 'Exaltation of the Holy Cross (Orthodox)', url: 'https://nazarethholycross.com/en/live#calendar' }], {
      name: 'Feasts in Nazareth',
      now,
      product: 'Christian calendar',
    });
    expect(ics).toContain('PRODID:-//Nazareth Holy Cross//Christian calendar//EN');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260927\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20260928\r\n');
    expect(ics).toContain('TRANSP:TRANSPARENT');
    expect(ics).toContain('URL:https://nazarethholycross.com/en/live#calendar');
    expect(ics).not.toMatch(/DTSTART:\d/);
  });

  it('writes a broadcast at its exact instant in UTC', () => {
    const start = Date.parse('2026-10-20T16:30:00Z');
    const ics = buildIcs([{ uid: 'b@x', startsAt: start, endsAt: start + 3_600_000, summary: 'Evening prayer' }], { name: 'N', now });
    expect(ics).toContain('DTSTART:20261020T163000Z');
    expect(ics).toContain('DTEND:20261020T173000Z');
    expect(ics).toContain('PRODID:-//Nazareth Holy Cross//Pilgrimage planner//EN'); // the planner's default is kept
  });
});

// ------------------------------------------------------------------------------------------------ the component

function renderCalendar({ locale = 'en', broadcasts = [] as CalendarBroadcast[], today = '2026-10-07' } = {}): ReactNode {
  return (
    <NextIntlClientProvider locale={locale} messages={en} timeZone="Asia/Jerusalem">
      <LiturgicalCalendar today={today} broadcasts={broadcasts} pageUrl="https://nazarethholycross.com/en/live" />
    </NextIntlClientProvider>
  );
}

describe('<LiturgicalCalendar>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00Z'));
    saveIcsFile.mockReset();
  });

  const grid = () => screen.getByRole('grid');
  const day = (date: string) => grid().querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)!;

  it('draws the month as an accessible grid: named by its month, one tab stop, today marked', () => {
    render(renderCalendar());
    expect(grid()).toHaveAccessibleName('October 2026');
    expect(within(grid()).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(grid()).getAllByRole('columnheader')[0]).toHaveTextContent('Sunday');
    const buttons = within(grid()).getAllByRole('button');
    expect(buttons).toHaveLength(31);
    expect(buttons.filter((b) => b.tabIndex === 0)).toEqual([day('2026-10-07')]);
    expect(day('2026-10-07')).toHaveAttribute('aria-current', 'date');
    expect(day('2026-10-07')).toHaveAccessibleName('Wednesday, October 7, 2026');
    expect(day('2026-10-07').closest('td')).toHaveAttribute('aria-selected', 'true');
    expect(day('2026-10-08').closest('td')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('calendar-day')).toHaveTextContent(cal.day.none);
  });

  it('moves through days and months with the keyboard and keeps the focus on the chosen day', () => {
    render(renderCalendar());
    day('2026-10-07').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(day('2026-10-08'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(day('2026-10-15'));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(day('2026-10-17'));
    fireEvent.keyDown(document.activeElement!, { key: 'PageDown' });
    expect(grid()).toHaveAccessibleName('November 2026');
    expect(document.activeElement).toBe(day('2026-11-17'));
    // All Saints: the day's name says the feast and its tradition, and the panel shows it.
    expect(day('2026-11-01')).toHaveAccessibleName('Sunday, November 1, 2026: All Saints (Catholic)');
    fireEvent.click(day('2026-11-01'));
    const panel = screen.getByTestId('calendar-day');
    expect(within(panel).getByText(cal.feasts.allSaints.name)).toBeInTheDocument();
    expect(within(panel).getByText(cal.feasts.allSaints.description)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: `${cal.ics.add}: ${cal.feasts.allSaints.name}` })).toBeInTheDocument();
  });

  it('mirrors Left and Right in a right-to-left language', () => {
    render(renderCalendar({ locale: 'he' }));
    day('2026-10-07').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(day('2026-10-08'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(day('2026-10-06'));
  });

  it('has month buttons and a way back to today', () => {
    render(renderCalendar());
    fireEvent.click(screen.getByRole('button', { name: cal.month.previous }));
    expect(grid()).toHaveAccessibleName('September 2026');
    // The Holy Cross in both traditions, each with the mark of Nazareth's own feasts.
    expect(day('2026-09-14')).toHaveAccessibleName('Monday, September 14, 2026: Exaltation of the Holy Cross (Catholic)');
    expect(day('2026-09-27')).toHaveAccessibleName('Sunday, September 27, 2026: Exaltation of the Holy Cross (Orthodox)');
    fireEvent.click(day('2026-09-27'));
    const panel = screen.getByTestId('calendar-day');
    expect(within(panel).getByText(cal.legend.nazareth)).toBeInTheDocument();
    expect(within(panel).getByText('September 14 on the Julian calendar.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: cal.month.today }));
    expect(grid()).toHaveAccessibleName('October 2026');
  });

  it('names a feast both traditions keep on the same day once, for both (Easter 2025)', () => {
    vi.setSystemTime(new Date('2025-04-01T09:00:00Z'));
    render(renderCalendar({ today: '2025-04-01' }));
    expect(day('2025-04-20')).toHaveAccessibleName('Sunday, April 20, 2025: Easter Sunday (Catholic and Orthodox)');
    // A transferred solemnity says so: the Annunciation of 2024 was kept on 8 April.
    cleanup();
    vi.setSystemTime(new Date('2024-04-01T09:00:00Z'));
    render(renderCalendar({ today: '2024-04-01' }));
    fireEvent.click(day('2024-04-08'));
    expect(within(screen.getByTestId('calendar-day')).getByText('Moved from March 25 by the rules of the Roman calendar.')).toBeInTheDocument();
  });

  it('lists the next feasts with the days left, and filters them by tradition', () => {
    render(renderCalendar());
    const list = () => within(screen.getByTestId('calendar-upcoming')).getAllByRole('listitem');
    expect(list()).toHaveLength(UPCOMING_COUNT);
    expect(list()[0]).toHaveTextContent(cal.feasts.allSaints.name);
    expect(list()[0]).toHaveTextContent('In 25 days');
    expect(list()[0]).toHaveTextContent(cal.tradition.catholic);

    fireEvent.click(screen.getByRole('radio', { name: cal.filter.orthodox }));
    expect(list()[0]).toHaveTextContent(cal.feasts.christmas.orthodoxName);
    expect(list()[0]).toHaveTextContent('December 25 on the Julian calendar.');
    expect(list().every((li) => li.textContent?.includes(cal.tradition.orthodox))).toBe(true);
    // The grid follows the filter too: no Catholic feast in November any more.
    fireEvent.click(screen.getByRole('button', { name: cal.month.next }));
    expect(day('2026-11-01')).toHaveAccessibleName('Sunday, November 1, 2026');

    fireEvent.click(screen.getByRole('radio', { name: cal.filter.all }));
    expect(day('2026-11-01')).toHaveAccessibleName('Sunday, November 1, 2026: All Saints (Catholic)');
  });

  it('says "today" and "tomorrow" in the countdown', () => {
    vi.setSystemTime(new Date('2026-10-31T09:00:00Z'));
    render(renderCalendar({ today: '2026-10-31' }));
    expect(within(screen.getByTestId('calendar-upcoming')).getAllByRole('listitem')[0]).toHaveTextContent('Tomorrow');
    cleanup();
    vi.setSystemTime(new Date('2026-11-01T09:00:00Z'));
    render(renderCalendar({ today: '2026-11-01' }));
    expect(within(screen.getByTestId('calendar-upcoming')).getAllByRole('listitem')[0]).toHaveTextContent('Today');
  });

  it('saves a feast to the visitor\'s calendar as an all-day .ics entry made in the browser', () => {
    render(renderCalendar());
    const first = within(screen.getByTestId('calendar-upcoming')).getAllByRole('listitem')[0];
    fireEvent.click(within(first).getByRole('button', { name: `${cal.ics.add}: ${cal.feasts.allSaints.name}` }));
    expect(saveIcsFile).toHaveBeenCalledTimes(1);
    const [ics, fileName] = saveIcsFile.mock.calls[0] as [string, string];
    expect(fileName).toBe('allSaints-2026-11-01.ics');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261101');
    expect(ics).toContain('SUMMARY:All Saints (Catholic)');
    expect(ics).toContain('URL:https://nazarethholycross.com/en/live#calendar');
  });

  it('shows the scheduled broadcasts on their day, with the time in Nazareth, and saves them at their instant', () => {
    render(renderCalendar({ broadcasts: [broadcast()] }));
    expect(screen.getByText(cal.legend.broadcast)).toBeInTheDocument();
    // (English puts a narrow no-break space before PM: read the time from Intl like the page does.)
    const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Jerusalem' }).format(Date.parse('2026-10-20T16:30:00Z'));
    expect(time).toMatch(/^7:30\sPM$/u);
    expect(day('2026-10-20')).toHaveAccessibleName(`Tuesday, October 20, 2026: live broadcast at ${time}: Evening prayer`);
    fireEvent.click(day('2026-10-20'));
    const panel = screen.getByTestId('calendar-day');
    expect(within(panel).getByText('Evening prayer')).toBeInTheDocument();
    expect(within(panel).getByText(`${time}, Nazareth time`)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: `${cal.ics.add}: Evening prayer` }));
    const [ics] = saveIcsFile.mock.calls[0] as [string];
    expect(ics).toContain('DTSTART:20261020T163000Z');
    expect(ics).toContain('DTEND:20261020T173000Z');
  });

  it('lists the month as buttons (the list alternative to the grid), and an empty month points to the next feast', () => {
    render(renderCalendar());
    // October 2026 has no feast in either tradition.
    expect(screen.queryByTestId('calendar-month-list')).not.toBeInTheDocument();
    expect(screen.getByText(cal.month.empty)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Next feast: ${cal.feasts.allSaints.name}`) }));
    expect(grid()).toHaveAccessibleName('November 2026');
    const list = screen.getByTestId('calendar-month-list');
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual([
      `November 1${cal.feasts.allSaints.name} (${cal.tradition.catholic})`,
      `November 29${cal.feasts.advent1.name} (${cal.tradition.catholic})`,
    ]);
    fireEvent.click(within(list).getAllByRole('button')[1]);
    expect(day('2026-11-29').closest('td')).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByTestId('calendar-day')).getByText(cal.feasts.advent1.description)).toBeInTheDocument();
  });

  it('without broadcasts the legend does not mention them', () => {
    render(renderCalendar());
    expect(screen.queryByText(cal.legend.broadcast)).not.toBeInTheDocument();
  });

  it('follows the date in Nazareth when the page stays open past midnight', () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T20:59:00Z')); // 23:59 in Nazareth
    render(renderCalendar());
    expect(day('2026-10-07')).toHaveAttribute('aria-current', 'date');
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(day('2026-10-08')).toHaveAttribute('aria-current', 'date');
  });
});
