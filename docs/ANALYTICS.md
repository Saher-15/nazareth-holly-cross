# Measuring sales without cookies

The owner's question (sales brief of 2026-10-10): **what does one paying customer cost?** Not how many people visited.
This page says what is counted, how, what is deliberately not done, and how to read the numbers.

## 1. What is counted

Five steps of a purchase. Each time one happens, the visitor's browser tells **our own API**, which adds one to a
counter of that day.

| Step | Name in the code | When |
|---|---|---|
| Page opened | `view` | the candle page (`/candle`) is opened |
| Order button pressed | `cta` | "Light My Candle" on the first screen |
| Details filled in | `details` | the candle form is complete and the visitor reaches the payment step |
| Payment started | `pay_start` | PayPal's window opens for a payment the API priced |
| Payment completed | `paid` | PayPal confirmed the payment |

`pay_start` and `paid` are counted for all three payments (`candle`, `order`, `donation`); `view`, `cta` and `details`
for the candle page, which is the landing page of the campaigns.

With every step goes the **campaign** of the visit: `utm_source`, `utm_medium` and `utm_campaign` of the link the
visitor arrived by. A visit without such a link is counted under "No campaign link".

## 2. What is deliberately not done

- **No cookie, no localStorage, no sessionStorage.** The campaign is read once from the address bar and kept in the
  page's memory (`web/src/lib/track.ts`); it survives moving between pages and is gone when the tab reloads or closes.
- **No visitor identifier.** A row of the database is `day, flow, event, source, medium, campaign, count`
  (`server/model/metric.js`). No address, no browser name, no time of day. A row cannot be linked to a person or to
  another row.
- **No third party.** Nothing is sent to Google, Meta or anyone else; no script from another site is loaded.
- **Not for visitors who said no.** Global Privacy Control and Do Not Track switch the counting off in the browser.
- **Not for robots.** Browser automation is silent in the browser; the API leaves out crawlers, link previews,
  monitors and scripts by their User-Agent (which is read for this and not stored).

This is why the site still needs no consent banner (`docs/DESIGN-GUIDE.md` 1.5, `docs/TODO-LEGAL.md`). The privacy
policy says that these totals are kept (`pilgrim.legal.privacy.sections.browser.p2`, all 14 languages).

**The price of this choice:** the numbers are counts of *actions*, not of *people*. One person who opens the page
twice is counted twice; nobody can be followed from the advert to the payment as an individual. A purchase is
attributed to a campaign only when it is paid in the same visit, without a reload in between. The advertising
platforms (Meta, Google) are told nothing, so they cannot optimise a campaign for purchases by themselves. If that is
wanted later, it needs their pixel, a consent banner for European visitors and a change of the privacy policy: an
owner and legal decision, not a code change alone.

## 3. Reading the numbers: the dashboard's "Campaigns" page

`admin/src/app/(app)/campaigns` (every admin may open it), from `GET /admin/metrics/funnel?flow=&from=&to=`:

- **From visit to payment:** the five totals of the chosen dates, each as a share of the openings.
- **Paid and saved in the system:** the number of paid candles (or orders) really saved in those dates. This is the
  exact number of customers. The browser's own "Payment completed" count can be a little lower (a visitor who asked
  not to be tracked, a lost request).
- **Cost of one paying customer:** type what was spent on advertising in those dates; the page divides it by the
  customers. Nothing is saved.
- **By campaign** and **by day:** the same five steps per campaign and per day.

Default range: the last 30 days; at most 366 days.

## 4. Marking a campaign

Every advert links to the candle page with three labels:

```
https://nazarethholycross.com/en/candle?utm_source=facebook&utm_medium=paid&utm_campaign=easter
```

`utm_source`: where the advert runs. `utm_medium`: the kind of advert. `utm_campaign`: a name for the campaign.
Small letters, digits, `. _ + -`; at most 60 characters (anything else is counted without a label). Use the language
of the audience in the address (`/de/candle`, `/es/candle`, ...).

## 5. Safeguards

- `POST /track` always answers `204` with no body, whatever is sent, and is limited to 60 requests per 15 minutes per
  address (`trackLimiter`). A failure to count is logged and never reaches the visitor.
- Campaign names come from the address bar, so anyone can invent them: a day holds at most 400 rows; later inventions
  are counted together as `other`.
- The collection is `metric`. Its unique index is declared in the model; in production indexes are built only by
  `node scripts/ensure-indexes.js --apply` (`docs/DATABASE.md`). Without the index two simultaneous first events of a
  day could create two rows for the same campaign: the report adds rows up, so the totals stay right.

Tests: `server/__tests__/metrics.test.js`, `web/tests/unit/track.test.ts`, `admin/tests/unit/funnel.test.ts`,
`admin/tests/e2e/pages.spec.ts`.
