// The feast of the day, or the next feast, for the home page's "Today in Nazareth" strip: a thin adapter over the
// site's Christian calendar (`web/src/lib/liturgical/`, docs/LITURGICAL-CALENDAR.md), so the home page and the
// calendar on /live always name the same next feast. Dates are calendar days in Nazareth ("YYYY-MM-DD").

import { daysBetween, nextFeasts, usesOrthodoxName, type FeastId, type IsoDate } from '@/lib/liturgical';

export type FeastOnDay = {
  /** The feast's id in the calendar (messages: pilgrim.calendar.feasts.<id>). */
  id: FeastId;
  date: IsoDate;
  /** The message key of its name, as the calendar on /live names it: the Orthodox name when only the Orthodox keep
   * it that day and it has one. */
  nameKey: string;
  /** True when the feast is on the given day itself. */
  today: boolean;
  /** Whole days from the given day to the feast (0 today). */
  days: number;
};

/** The feast on `date` ("YYYY-MM-DD", Nazareth), or else the next one, of either tradition. */
export function feastOn(date: IsoDate): FeastOnDay {
  const [next] = nextFeasts(date, 1, 'all');
  const days = daysBetween(date, next.date);
  const nameKey = `pilgrim.calendar.feasts.${next.id}.${usesOrthodoxName(next) ? 'orthodoxName' : 'name'}`;
  return { id: next.id, date: next.date, nameKey, today: days === 0, days };
}
