import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// The sales funnel counted without cookies (services/metrics.js, docs/ANALYTICS.md): POST /track adds to anonymous
// daily counters, GET /admin/metrics/funnel reports them per campaign and per day.
vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../model/candle.js', async () => (await import('./helpers/fakes.js')).fakeModule('Candle'));
vi.mock('../model/order.js', async () => (await import('./helpers/fakes.js')).fakeModule('Order'));
const { fakes } = await import('./helpers/fakes.js');
const { signedIn, freshIp, startClient } = await import('./helpers/admin.js');
const { signSessionToken } = await import('../services/adminSessions.js');
const { createApp } = await import('../app.js');
const { cleanLabel, dayOf, looksAutomated, recordEvent, reportRange, MAX_ROWS_PER_DAY } = await import('../services/metrics.js');
const { http, close } = startClient(createApp());
afterAll(close);

const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const track = (body, { ua = BROWSER, ip = freshIp() } = {}) => {
  const req = http.post('/track').set('X-Forwarded-For', ip);
  if (ua !== null) req.set('User-Agent', ua);
  return req.send(body);
};
const today = dayOf(new Date());
const rows = () => fakes.Metric.docs;

beforeEach(() => {
  fakes.Metric.reset();
  fakes.Candle.reset();
  fakes.Order.reset();
  fakes.Admin.reset();
  fakes.AdminSession.reset();
});

describe('POST /track', () => {
  it('adds one to today’s counter for the event and its campaign, and answers 204 with nothing', async () => {
    const event = { flow: 'candle', event: 'view', source: 'Facebook', medium: 'Paid Social', campaign: 'easter-2027' };
    const first = await track(event);
    expect(first.status).toBe(204);
    expect(first.text).toBe('');
    expect(first.headers['cache-control']).toBe('no-store');
    await track(event);
    await track({ flow: 'candle', event: 'paid', source: 'facebook', medium: 'paid_social', campaign: 'easter-2027' });
    expect(rows()).toHaveLength(2);
    expect(rows().find((r) => r.event === 'view')).toMatchObject({ day: today, flow: 'candle', source: 'facebook', medium: 'paid_social', campaign: 'easter-2027', count: 2 });
    expect(rows().find((r) => r.event === 'paid').count).toBe(1);
  });

  it('stores nothing about the visitor: only the day, the event, the campaign and a number', async () => {
    await track({ flow: 'candle', event: 'cta', source: 'google', email: 'a@example.com', name: 'Mary', ip: '1.2.3.4', id: 'visitor-42' }, { ip: '203.0.113.77' });
    const stored = JSON.stringify(rows());
    expect(Object.keys(rows()[0]).filter((k) => k !== '_id').sort()).toEqual(['campaign', 'count', 'day', 'event', 'flow', 'medium', 'source']);
    for (const secret of ['a@example.com', 'Mary', '1.2.3.4', '203.0.113.77', 'visitor-42', 'iPhone', 'Safari']) expect(stored).not.toContain(secret);
  });

  it('counts a visit without a campaign link under empty labels', async () => {
    await track({ flow: 'order', event: 'pay_start' });
    expect(rows()[0]).toMatchObject({ flow: 'order', event: 'pay_start', source: '', medium: '', campaign: '', count: 1 });
  });

  it('ignores what is not a known step, always with the same 204', async () => {
    for (const body of [{}, null, [], 'x', { flow: 'candle' }, { event: 'view' }, { flow: 'admin', event: 'view' }, { flow: 'candle', event: 'refund' }, { flow: { $ne: '' }, event: 'view' }, { flow: 'candle', event: ['view'] }]) {
      expect((await track(body)).status).toBe(204);
    }
    expect(rows()).toHaveLength(0);
  });

  it('drops labels that are not short plain tokens instead of storing them', async () => {
    await track({ flow: 'candle', event: 'view', source: '<script>alert(1)</script>', medium: { $gt: '' }, campaign: 'x'.repeat(200) });
    expect(rows()[0]).toMatchObject({ source: '', medium: '', campaign: '' });
    expect(cleanLabel('  Spring Sale 2027 ')).toBe('spring_sale_2027');
    expect(cleanLabel('news.letter+a_b-c')).toBe('news.letter+a_b-c');
    for (const bad of ['', ' ', '-starts-with-dash', 'a/b', 'a?b=c', 'é', 42, null, ['a']]) expect(cleanLabel(bad)).toBe('');
  });

  it('leaves crawlers, link previews, monitors and scripts out of the counts', async () => {
    for (const ua of ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36', 'curl/8.4.0', 'UptimeRobot/2.0; http://www.uptimerobot.com/', 'x', null]) {
      expect((await track({ flow: 'candle', event: 'view' }, { ua })).status).toBe(204);
    }
    expect(rows()).toHaveLength(0);
    expect(looksAutomated(BROWSER)).toBe(false);
  });

  it('a day never grows past its cap: invented campaign names are counted together as "other"', async () => {
    fakes.Metric.seed(Array.from({ length: MAX_ROWS_PER_DAY }, (_, i) => ({ day: today, flow: 'candle', event: 'view', source: `s${i}`, medium: '', campaign: '', count: 1 })));
    await recordEvent({ flow: 'candle', event: 'view', source: 'brand-new' });
    await recordEvent({ flow: 'candle', event: 'view', source: 'another-new' });
    await recordEvent({ flow: 'candle', event: 'view', source: 's7' }); // an existing row still counts normally
    await recordEvent({ flow: 'candle', event: 'view' }); // and so does a visit without a campaign
    expect(rows()).toHaveLength(MAX_ROWS_PER_DAY + 2);
    expect(rows().find((r) => r.source === 'other').count).toBe(2);
    expect(rows().find((r) => r.source === 's7').count).toBe(2);
    expect(rows().some((r) => r.source === 'brand-new')).toBe(false);
  });

  it('is rate limited per address, still answering without a body', async () => {
    const ip = freshIp();
    let limited = 0;
    for (let i = 0; i < 64; i += 1) if ((await track({ flow: 'candle', event: 'view' }, { ip })).status === 429) limited += 1;
    expect(limited).toBeGreaterThan(0);
    expect(rows()[0].count).toBeLessThanOrEqual(60);
  });
});

describe('GET /admin/metrics/funnel', () => {
  const seedFunnel = () =>
    fakes.Metric.seed([
      { day: '2026-10-01', flow: 'candle', event: 'view', source: 'facebook', medium: 'paid', campaign: 'oct', count: 200 },
      { day: '2026-10-01', flow: 'candle', event: 'cta', source: 'facebook', medium: 'paid', campaign: 'oct', count: 40 },
      { day: '2026-10-02', flow: 'candle', event: 'paid', source: 'facebook', medium: 'paid', campaign: 'oct', count: 4 },
      { day: '2026-10-02', flow: 'candle', event: 'view', source: '', medium: '', campaign: '', count: 50 },
      { day: '2026-10-02', flow: 'candle', event: 'paid', source: '', medium: '', campaign: '', count: 1 },
      { day: '2026-10-02', flow: 'order', event: 'paid', source: 'facebook', medium: 'paid', campaign: 'oct', count: 9 },
      { day: '2026-09-01', flow: 'candle', event: 'view', source: 'old', medium: '', campaign: '', count: 999 },
    ]);
  const get = async (query, role = 'viewer') => {
    const who = await signedIn(signSessionToken, { username: `${role}.reader`, role });
    return http.get(`/admin/metrics/funnel${query}`).set('X-Forwarded-For', freshIp()).set(who.auth);
  };

  it('reports the totals, each campaign and each day of the range, for one flow', async () => {
    seedFunnel();
    fakes.Candle.seed([
      { firstName: 'A', lastName: 'B', email: 'a@example.com', prayer: 'p', paymentVerified: true, createdAt: new Date('2026-10-02T10:00:00Z') },
      { firstName: 'A', lastName: 'B', email: 'a@example.com', prayer: 'p', paymentVerified: true, createdAt: new Date('2026-10-02T23:59:59Z') },
      { firstName: 'A', lastName: 'B', email: 'a@example.com', prayer: 'p', paymentVerified: false, createdAt: new Date('2026-10-02T10:00:00Z') },
      { firstName: 'A', lastName: 'B', email: 'a@example.com', prayer: 'p', paymentVerified: true, createdAt: new Date('2026-10-03T00:00:00Z') },
    ]);
    const res = await get('?from=2026-10-01&to=2026-10-02');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ from: '2026-10-01', to: '2026-10-02', flow: 'candle', paidConfirmed: 2 });
    expect(res.body.totals).toEqual({ view: 250, cta: 40, details: 0, pay_start: 0, paid: 5 });
    expect(res.body.campaigns).toEqual([
      { source: 'facebook', medium: 'paid', campaign: 'oct', view: 200, cta: 40, details: 0, pay_start: 0, paid: 4 },
      { source: '', medium: '', campaign: '', view: 50, cta: 0, details: 0, pay_start: 0, paid: 1 },
    ]);
    expect(res.body.days.map((d) => [d.day, d.view, d.paid])).toEqual([['2026-10-01', 200, 0], ['2026-10-02', 50, 5]]);
  });

  it('reads another flow when asked, and refuses an unknown one', async () => {
    seedFunnel();
    const orders = await get('?flow=order&from=2026-10-01&to=2026-10-02');
    expect(orders.body.totals.paid).toBe(9);
    expect(orders.body.paidConfirmed).toBe(0);
    expect((await get('?flow=everything')).status).toBe(400);
    expect((await get('?flow[$ne]=x')).status).toBe(400);
  });

  it('defaults to the last 30 days and never reads more than a year', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(reportRange({}, now)).toEqual({ from: '2026-09-11', to: '2026-10-10' });
    expect(reportRange({ from: '2026-10-05', to: '2026-10-07' }, now)).toEqual({ from: '2026-10-05', to: '2026-10-07' });
    expect(reportRange({ from: '2020-01-01', to: '2026-10-10' }, now)).toEqual({ from: '2025-10-10', to: '2026-10-10' });
    expect(reportRange({ from: '2026-10-09', to: '2026-10-01' }, now).from).toBe('2026-09-02'); // from after to: the default span
    expect(reportRange({ from: 'yesterday', to: { $gt: '' } }, now)).toEqual({ from: '2026-09-11', to: '2026-10-10' });
  });

  it('needs a signed-in admin; any role may read it', async () => {
    expect((await http.get('/admin/metrics/funnel').set('X-Forwarded-For', freshIp())).status).toBe(401);
    for (const role of ['viewer', 'editor', 'owner']) expect((await get('', role)).status).toBe(200);
  });
});
