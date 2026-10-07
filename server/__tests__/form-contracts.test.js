import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

// docs/FORM-CONTRACTS.md: what the forms of the site and the dashboard send, against what the routes read. The forms
// mirror these rules (web/src/lib/formRules.ts, web/tests/unit/form-contracts.test.ts); these tests pin the API side.

vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../model/review.js', async () => (await import('./helpers/fakes.js')).fakeModule('Review'));
vi.mock('../model/candle.js', async () => (await import('./helpers/fakes.js')).fakeModule('Candle'));
vi.mock('../model/contact.js', async () => (await import('./helpers/fakes.js')).fakeModule('Contact'));

const mail = vi.hoisted(() => ({ sendMail: vi.fn(async () => true) }));
vi.mock('../services/emailService.js', () => ({ sendMail: mail.sendMail, SENDER: {} }));

const { fakes } = await import('./helpers/fakes.js');
const { freshIp, signedIn, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { signSessionToken } = await import('../services/adminSessions.js');

const { http, close } = startClient(createApp());
afterAll(close);

let editor;
beforeAll(async () => {
  editor = await signedIn(signSessionToken, { username: 'contract-editor', role: 'editor' });
});
beforeEach(() => {
  for (const name of ['Review', 'Candle', 'Contact', 'AuditLog']) fakes[name].reset();
});

describe('the dashboard finds a site review by where the reviewer is from', () => {
  it('searches place (new reviews) as well as email (older reviews kept the place there)', async () => {
    fakes.Review.seed([
      { fullName: 'New', place: 'Italy', email: '', msg: 'Wonderful', approved: true, createdAt: new Date() },
      { fullName: 'Old', email: 'Germany', msg: 'Wonderful', approved: true, createdAt: new Date() },
      { fullName: 'Other', place: 'Chile', email: '', msg: 'Wonderful', approved: true, createdAt: new Date() },
    ]);
    const find = (q) => http.get(`/admin/site-reviews?q=${q}`).set('X-Forwarded-For', freshIp()).set(editor.auth);
    expect((await find('ital')).body.items.map((r) => r.fullName)).toEqual(['New']);
    expect((await find('germany')).body.items.map((r) => r.fullName)).toEqual(['Old']);
  });
});

describe('e-mail addresses: the API refuses what a looser pattern accepts (the forms now refuse them too)', () => {
  const candle = (email) => http.post('/candle/lightACandle').set('X-Forwarded-For', freshIp())
    .send({ firstName: 'Anna', lastName: 'Rossi', email, prayer: 'Annunciation church, Peace' });
  const contact = (email) => http.post('/contact/contact_us_request').set('X-Forwarded-For', freshIp())
    .send({ fullName: 'Anna Rossi', email, phone: '+39 06 0000 0000', msg: 'A question' });

  it.each(['anna@exa_mple.com', 'josé@example.com', 'a,b@example.com', 'a&b@example.com'])('%s is refused (422)', async (email) => {
    expect((await candle(email)).body.error).toBe('Bad input: invalid email format');
    expect((await contact(email)).body.error).toBe('Bad input: invalid email format');
  });

  it('an ordinary address is accepted', async () => {
    expect((await candle('anna@example.com')).status).toBe(200);
    expect((await contact('anna@example.com')).status).toBe(201);
  });

  // Data minimisation (security review 06, finding 8): the phone number is optional on the form, the route and the model.
  it.each([
    ['no phone', {}],
    ['an empty phone', { phone: '' }],
    ['a null phone', { phone: null }],
  ])('the contact route accepts a message with %s and stores it as not given', async (_label, extra) => {
    fakes.Contact.reset();
    const res = await http.post('/contact/contact_us_request').set('X-Forwarded-For', freshIp())
      .send({ fullName: 'Anna Rossi', email: 'anna@example.com', msg: 'A question', ...extra });
    expect(res.status).toBe(201);
    expect(fakes.Contact.docs).toHaveLength(1);
    expect(fakes.Contact.docs[0].phone).toBe('');
  });

  it('a phone that is given is stored trimmed; one that is not text is refused', async () => {
    fakes.Contact.reset();
    const send = (phone) => http.post('/contact/contact_us_request').set('X-Forwarded-For', freshIp())
      .send({ fullName: 'Anna Rossi', email: 'anna@example.com', msg: 'A question', phone });
    expect((await send('  +39 06 0000 0000 ')).status).toBe(201);
    expect(fakes.Contact.docs[0].phone).toBe('+39 06 0000 0000');
    for (const bad of [{ $ne: null }, ['1'], 5]) expect((await send(bad)).status, JSON.stringify(bad)).toBe(422);
    expect(fakes.Contact.docs).toHaveLength(1);
  });

  it('the model does not require the phone either', async () => {
    const RealContact = (await vi.importActual('../model/contact.js')).default;
    expect(new RealContact({ fullName: 'Anna Rossi', email: 'anna@example.com', msg: 'A question' }).validateSync()).toBeUndefined();
  });
});

describe('lengths are checked on the text as the sanitiser stored it ("&" becomes "&amp;")', () => {
  it('a 1000-character site review with an "&" reaches the model as 1004 characters, over its limit', async () => {
    // The fake model stores without validating, so what the route handed to the model is checked against the real one.
    await http.post('/review/addReview').set('X-Forwarded-For', freshIp()).send({ fullName: 'Anna', place: 'Italy', msg: `${'x'.repeat(999)}&` });
    const stored = fakes.Review.docs[0].msg;
    expect(stored).toBe(`${'x'.repeat(999)}&amp;`);
    const RealReview = (await vi.importActual('../model/review.js')).default;
    expect(new RealReview({ fullName: 'Anna', msg: stored }).validateSync()?.errors.msg).toBeTruthy();
  });
});
