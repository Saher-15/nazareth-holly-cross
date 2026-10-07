# The Christian (liturgical) calendar

The `/live` page has a calendar of the great feasts of the Catholic and the Orthodox Churches, the two traditions of
Nazareth, with the broadcasts the team schedules in the dashboard. This file says where every date comes from, which
conventions the calendar follows and why, how it is built and tested, and how to add a feast or a language.

Nothing in it is a date typed in for a year: every date is computed, for any year from 1900 to 2099 (the grid's range;
the algorithms themselves work from 1583).

## 1. What the visitor sees

A section "Feasts through the year" (`pilgrim.calendar.title`) between the live player and the past broadcasts
(`web/src/app/[locale]/live/page.tsx`, one insertion point):

- **A filter**: both traditions, Catholic, Orthodox (real radio buttons in a `fieldset`).
- **The month grid** (`role="grid"`): today in a gold disc (and `aria-current="date"`), the chosen day framed in gold,
  and under each day number a mark per tradition: a **gold dot** (Catholic), a **cream diamond** (Orthodox), a
  **hollow ring** (a scheduled live broadcast), and a **small gold cross** in the corner for Nazareth's own feasts (the
  Annunciation and the Holy Cross). Shape and colour both differ, a legend says it in words, and every day's
  accessible name lists its feasts with their tradition ("Sunday, November 1, 2026: All Saints (Catholic)"), so no
  information is carried by colour alone.
- **The chosen day**: its feasts with a one-line description, the tradition badges, a note when a Catholic solemnity
  was moved or an Orthodox fixed feast is dated on the Julian calendar, and "Add to calendar".
- **"In <month>"**: the month's feasts and broadcasts as a list of buttons (the list alternative to the grid); an
  empty month points to the next feast.
- **Upcoming feasts**: the next 8 feasts of the chosen tradition(s), each with its date in the visitor's language,
  the days left ("In 25 days", "Tomorrow", "Today"), the tradition badge, a one-line description and "Add to
  calendar".
- **About the dates**: the conventions below in four sentences, in every language (`pilgrim.calendar.notes`).

Keyboard (WAI-ARIA grid / date-picker pattern): the grid is one tab stop (the chosen day); the arrows move by a day or
a week (Left and Right follow the screen, so in Hebrew and Arabic Left is the next day), Home and End go to the first
and last day of the week, Page Up and Page Down to the previous and next month, with Shift to the previous and next
year. The month heading is a polite live region, so a screen reader hears "November 2026" when the month changes.

## 2. Conventions (and their sources)

| Question | What the calendar does | Source |
|---|---|---|
| Catholic calendar | Gregorian calendar; Easter by the Gregorian computus. The Latin Patriarchate of Jerusalem and the Basilica of the Annunciation in Nazareth follow it (in 2024 the Annunciation was moved in Nazareth to 8 April because 25 March fell in Holy Week "according to the Gregorian liturgical calendar") | lpj.org, "From Nazareth: celebrating the feast of the Annunciation 2024"; LPJ Holy Week guidelines 2020 |
| Orthodox calendar | Julian calendar for fixed feasts (13 days later on our calendar until 28 February 2100, 14 after) and Julian Easter: the calendar of the Greek Orthodox Patriarchate of Jerusalem, to which the Greek Orthodox Church of the Annunciation in Nazareth belongs ("March 25/April 7", "14/27 September") | en.jerusalem-patriarchate.info, posts on the Annunciation (2022) and the Exaltation of the Cross (2021) |
| Catholics with the Orthodox Easter | **Not applied, but said in the notes.** In October 2012 the Assembly of Catholic Ordinaries of the Holy Land asked Catholic parishes (Latin and Eastern) in Israel, Palestine, Jordan and Cyprus to keep Easter on the Julian date, except Jerusalem and Bethlehem (Status Quo). In practice it is mixed: Jordan has done it for decades, many Galilee parishes do, the Latin Patriarchate and the Custody keep the Gregorian date, and no final decree approved by the Holy See was found. The calendar shows the Catholic Church's (Gregorian) Easter and tells visitors that some parishes of the Holy Land keep Easter with the Orthodox | custodia.org (17 Oct 2012, archived), Fides 25 Mar 2013 and 10 Apr 2015 |
| Orthodox Churches on the revised calendar | Not shown separately. The Churches of Greece, Romania, Bulgaria, Cyprus, Antioch and others keep fixed feasts on the Gregorian dates (with the Julian Easter); the notes say so. Visitors from those countries see their Christmas under "Catholic" dates: an honest limit of a two-tradition calendar | |
| Roman Rite transfers | St Joseph (19 March) in Holy Week: the Saturday before Palm Sunday; on a Sunday of Lent: the Monday after. The Annunciation (25 March) from Palm Sunday to the Second Sunday of Easter: the Monday after that Sunday; on a Sunday of Lent: the Monday after. The Immaculate Conception (8 December) on a Sunday (the Second Sunday of Advent): Monday 9 December. The Orthodox never move a feast (the Annunciation is kept even on Pascha) | Universal Norms on the Liturgical Year and the Calendar, nos. 5 and 60; Congregation for Divine Worship, notification in *Notitiae* 42 (2006), as applied by the England and Wales Liturgy Office Ordo 2008 (St Joseph 15 March, Annunciation 31 March); 2023 St Joseph on 20 March; 2024 Immaculate Conception on 9 December |
| Epiphany, Ascension, Corpus Christi | On their own days (6 January, Thursday Easter + 39, Thursday Easter + 60), as the universal calendar and the Custody keep them. The notes say that parishes of the Holy Land usually keep Corpus Christi on the following Sunday, and the Catholic note that some countries move all three to a Sunday is in the docs only | custodia.org, "The solemnity of Corpus Christi at the Holy Sepulcher" (2026); cicts.org Christmas schedule (Epiphany 6 January); Fides 27 May 2022 (Ascension on Thursday) |
| A feast that falls on a Sunday | Only the three solemnities above are moved. A feast (not a solemnity or a feast of the Lord) that falls on a Sunday in Ordinary Time gives way to the Sunday in the Roman Rite (the Nativity of Mary in 2024, for example); the calendar still shows its date | |
| Orthodox Pentecost and Trinity | Pentecost is also the feast of the Holy Trinity in the East ("Pentecost (Holy Trinity)"); the Orthodox Sunday of All Saints is the Sunday after Pentecost | Wikipedia "Pentecost", "Clean Monday"; monasterevmc.org |
| Time zone | Every date is a calendar day in Nazareth (`Asia/Jerusalem`): "today", the countdown and the day a broadcast belongs to are Nazareth's, whatever the visitor's own zone | `web/src/lib/time.ts` |
| Digits | Western digits in every language (`numberingSystem: 'latn'`), like the rest of the site | `docs/GLOSSARY.md` |
| First day of the week | Unicode CLDR's default for the country each language points to: Sunday for en, pt (Brazil), he; Saturday for ar (Egypt); Monday for the European languages. Written out in `weekStartFor` (`web/src/components/calendar/calendarModel.ts`), not read from `Intl.Locale` week info, so the server and every browser draw the same grid | CLDR `weekData` |

Easter tables used by the tests (2000-2040, both traditions) were copied from Wikipedia's "List of dates for Easter"
(WCC/MECC Aleppo 1997 tables), cross-checked year by year against the Syriac Orthodox Church's table "Catholic &
Orthodox Easter 2005-2105" (soc-wus.org) and the WCC's "Towards a common date for Easter"; 2000 from the Wikipedia text
and truecalendar.com.

## 3. The feasts

`FEASTS` in `web/src/lib/liturgical/feasts.ts` (in the order of the liturgical year; "E" is Easter of that tradition):

| id | Catholic | Orthodox | Notes |
|---|---|---|---|
| `maryMotherOfGod` | 1 January | | |
| `epiphany` | 6 January | 6 January Julian (19 January) | Orthodox name "Theophany" |
| `presentation` | 2 February | 2 February Julian (15 February) | Orthodox name "Meeting of the Lord" |
| `cleanMonday` | | E - 48 | start of Great Lent |
| `ashWednesday` | E - 46 | | |
| `stJoseph` | 19 March, moved by the rules | | |
| `annunciation` | 25 March, moved by the rules | 25 March Julian (7 April) | **Nazareth's feast**; Orthodox name "Annunciation of the Theotokos" |
| `palmSunday` | E - 7 | E - 7 | |
| `holyThursday`, `goodFriday`, `holySaturday` | E - 3, E - 2, E - 1 | the same | Orthodox names "Great and Holy ..." |
| `easter` | E | E | Orthodox name "Pascha (Easter)" |
| `divineMercy` | E + 7 | | |
| `ascension` | E + 39 | E + 39 | |
| `pentecost` | E + 49 | E + 49 | Orthodox name "Pentecost (Holy Trinity)" |
| `trinity` | E + 56 | | |
| `corpusChristi` | E + 60 | | |
| `transfiguration` | 6 August | 6 August Julian (19 August) | Mount Tabor is a few kilometres from Nazareth |
| `assumption` | 15 August | 15 August Julian (28 August) | Orthodox name "Dormition of the Theotokos" |
| `nativityOfMary` | 8 September | 8 September Julian (21 September) | |
| `holyCross` | 14 September | 14 September Julian (27 September) | **Nazareth Holy Cross's feast**; an Orthodox name of its own where the language has one (French "Exaltation de la Sainte Croix" beside the Missal's "Croix glorieuse") |
| `allSaints` | 1 November | E + 56 (Sunday after Pentecost) | Orthodox name "Sunday of All Saints" |
| `advent1` ... `advent4` | the four Sundays before Christmas (the fourth is the last Sunday before 25 December) | | |
| `immaculateConception` | 8 December, moved by the rules | | |
| `christmas` | 25 December | 25 December Julian (7 January) | Orthodox name "Nativity of Christ" |

When the two traditions celebrate a feast on the same day (Easter in 2025, 2028, 2031, 2034 ...; the whole Easter
cycle with it), the calendar shows one entry "Catholic and Orthodox" under the common name.

## 4. How it is built

| Part | File | What it does |
|---|---|---|
| Calendar days | `web/src/lib/liturgical/civil.ts` | Dates as `YYYY-MM-DD` strings, arithmetic on day numbers (never a `Date` for a feast, so no time zone can shift it), Julian/Gregorian conversion through the Julian Day Number, `civilDateIn(instant, zone)` |
| Easter | `web/src/lib/liturgical/easter.ts` | `westernEaster(year)` (Anonymous Gregorian algorithm: Meeus, Jones, Butcher), `orthodoxEaster(year)` (Meeus's Julian algorithm, written in the Gregorian calendar) |
| Feasts | `web/src/lib/liturgical/feasts.ts` | `FEASTS`, the Roman transfer rules, Advent, `feastsOfYear(year)` (merged and sorted, cached per year) |
| Public API | `web/src/lib/liturgical/index.ts` | `nextFeasts(date, n, tradition)`, `feastsBetween(from, to, tradition)`, `feastsOn(date)`, `nazarethToday()`. No React, no messages: any page can use it (the home page's "next feast" can switch to `nextFeasts(new Date(), 1, 'all')`) |
| Grid model | `web/src/components/calendar/calendarModel.ts` | Week start per language, the weeks of a month, what each key does, the Nazareth day of each broadcast |
| Section | `web/src/components/calendar/LiturgicalCalendarSection.tsx` | Server component: the head, the notes, the broadcasts (server read), their structured data; hands the calendar's texts to the client part through its own `NextIntlClientProvider`, so they are sent only with `/live` and not with every page |
| Calendar | `web/src/components/calendar/LiturgicalCalendar.tsx` + `.module.css` | Client component: filter, grid, day, month list, upcoming list, "add to calendar" |
| Broadcasts | `web/src/lib/broadcastSchedule.ts` | The adapter for `GET /live/schedule` (below) |
| Calendar files | `web/src/data/pilgrim/ics.ts` | The planner's iCalendar writer, extended with all-day events (feasts: `DTSTART;VALUE=DATE`) and exact instants (broadcasts: UTC) and `saveIcsFile` (the planner uses it too). Made in the browser; nothing is sent anywhere |

### Scheduled broadcasts

The API route `GET /live/schedule` (added by the live-recordings work, `docs/LIVE.md`) answers
`{ timeZone, items: [{ id, title, description, startsAt, status }] }` with the published broadcasts still to come.
`web/src/lib/broadcastSchedule.ts` is the only code that knows that shape. It reads the route on the server when
`/live` is rendered (through `getJson`, cached for a minute by Next's data cache), accepts an object with `items` or a
bare array, keeps only valid items whose status is `scheduled` or `live` (or missing), decodes the HTML entities the
API's sanitiser adds, and never throws: a 404 (an API without the route, as production is today), a failure or an
answer slower than 2.5 seconds means "no broadcasts", and after a 404 it does not ask again for 10 minutes (2 after
another failure). So the calendar lights up by itself once the route is deployed.

A broadcast is placed on its day in Nazareth, shown with its time in Nazareth, and saved to a calendar as an exact
instant (one hour long; the API gives no end). **Structured data**: each scheduled broadcast is a schema.org `Event`
(online, `VirtualLocation` = the `/live` page in that language) in its own JSON-LD block of the section. Feasts get
**no** structured data: they are not events organised by the site.

## 5. Tests

- `web/tests/unit/liturgical.test.ts`: the Easter tables 2000-2040 for both traditions (copied from the sources
  above), every Easter of 1900-2099 a Sunday in its window and the gap between the two always 0, 1, 4 or 5 weeks, the
  movable feasts' offsets and weekdays for every year 2000-2040, the fixed feasts in both calendars, the Julian
  conversion (including the change to 14 days in 2100), Advent, every transfer case with real years, the merge of
  shared days, `nextFeasts` (filters, year boundary, an instant read in Nazareth), and Nazareth's date across the
  clock changes.
- `web/tests/unit/calendar.test.tsx`: the grid model (week starts, layouts, keys, broadcasts by Nazareth day), the
  broadcast adapter (shapes, bad items, 404 pause, deadline), the structured data, the `.ics` entries, and the
  component (ARIA grid, keyboard and focus, right to left, filter, countdown, month list, add to calendar, broadcasts,
  midnight).
- `web/tests/e2e/calendar.spec.ts`: the real page in Edge: today, keyboard, filter, a real `.ics` download, Hebrew and
  Arabic, axe (WCAG 2.2 AA) on the section, 320 px in Arabic, and no structured data for feasts.

## 6. How to add a feast

1. Add an entry to `FEASTS` in `web/src/lib/liturgical/feasts.ts`: an `id`, and a rule per tradition that keeps it
   (`easter(offset)`, `fixed(month, day)` on that tradition's calendar, or Advent). Add `orthodoxName: true` if the
   Orthodox Church calls it differently, `nazareth: true` only for a feast of Nazareth itself.
2. Add `pilgrim.calendar.feasts.<id>.name` and `.description` (and `.orthodoxName`) to **all 14** message files, with
   the established liturgical name of each language (the Roman Missal of that language for Catholic names, the
   Orthodox Church's own usage for Orthodox names). Mark it for review in `docs/TRANSLATION-REVIEW.md`.
3. Add its dates to `web/tests/unit/liturgical.test.ts` (a known year from a published source), and to the table in
   section 3 above. Run `npm test` in `web/`.

## 7. How to add a language

The calendar follows `docs/DESIGN-GUIDE.md` section 14.2: add the `pilgrim.calendar` block to the new
`web/src/messages/<code>.json` (the unit tests list every missing key and check the plural forms of
`pilgrim.calendar.upcoming.countdown`), add the language's first day of the week to `WEEK_START` in
`web/src/components/calendar/calendarModel.ts` if it is not Monday, and look at `/live` in that language at 390 and
1366 px.

## 8. Not verified, and to review

- **The feast names and descriptions in the 13 other languages were translated with care but by machine, not by a
  native speaker or a priest of each tradition.** A review by clergy or native readers (Catholic and Orthodox usage
  differ inside one language) is recommended; the open questions are listed in `docs/TRANSLATION-REVIEW.md`.
- The local practice of each parish of Nazareth (which Catholic parishes keep the Julian Easter today; the Melkite
  Greek Catholic usage) was not confirmed with the parishes; the notes ask visitors to check with their parish.
- The broadcasts were tested against the adapter and in unit tests only: the production API does not have
  `GET /live/schedule` yet, so no real scheduled broadcast was shown end to end.
- Real screen readers, Firefox and Safari were not used (Edge only, like the rest of the suite).
