// docs/FORM-CONTRACTS.md: the dashboard's forms must refuse what the API refuses (and say why in the admin's language),
// and must never drop what the admin typed without a word. The API's own rules are imported from server/ itself, so
// the two cannot drift apart unnoticed.
import { describe, expect, it } from 'vitest';
import { isEmail as serverIsEmail } from '../../../server/utils/validate.js';
import { checkPasswordPolicy } from '../../../server/services/passwordPolicy.js';
import { url as serverUrl, str as serverStr, arrayOf as serverArrayOf } from '../../../server/utils/schema.js';
import { isApiEmail } from '@/lib/email';
import { storedLength } from '@/lib/entities';
import { isImageUrl } from '@/lib/firebase-upload';
import { isUsername, passwordProblem } from '@/lib/password';
import { EMPTY_PRODUCT, MAX_COLORS, MAX_COLOR_LENGTH, parseColors, toBody, validateProduct, type ProductValues } from '@/lib/product-form';
import { reviewerEmail, reviewerPlace } from '@/lib/format';

const accepts = (rule: (value: unknown, field: string) => unknown, value: unknown) => {
  try {
    rule(value, 'field');
    return true;
  } catch {
    return false;
  }
};
// What the API's sanitiser does to body text before the routes see it (admin product and payment bodies are sanitised).
const sanitised = (text: string) => text.replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

describe('privacy look-up: the e-mail check is the API\'s', () => {
  it.each(['anna@example.com', 'Anna.M+tag@sub.example.co.il', 'anna@exa_mple.com', 'josé@example.com', 'a,b@example.com', 'a&b@example.com', 'anna@example', 'nope'])('%s', (address) => {
    expect(isApiEmail(address)).toBe(serverIsEmail(sanitised(address.trim())));
  });
});

describe('password policy: the same answer as the API for every sample', () => {
  const samples: [string, string][] = [
    ['short', 'owner'], ['a'.repeat(201), 'owner'], ['OwnerOwnerOwner', 'ownerownerowner'], ['Resetpass-123', 'resetpass'],
    ['password1234', 'x'], ['Pass_Word_1234', 'x'], ['Nazareth-1234', 'x'], ['abababababab', 'x'], ['A-Fine-Passphrase-1', 'owner'],
    ['Olive-Courtyard-Lamp-77', 'nazarethholycross@gmail.com'], ['casey.test-2026', 'casey.test'],
  ];
  it.each(samples)('%s (user %s)', (password, username) => {
    expect(passwordProblem(password, username) === null).toBe(checkPasswordPolicy(password, username) === null);
  });
});

describe('new user: a name the form accepts is one the API accepts', () => {
  // The rule of route/admin/users.js (a variable: the JS signature has no type for `pattern`).
  const rule = { min: 3, max: 64, pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/ };
  const api = serverStr(rule);
  it.each(['casey', 'casey.test', 'a-b_c.d', '.casey', '-casey', '_casey', 'ca', 'ca$ey', 'x'.repeat(40), 'x'.repeat(41)])('%s', (name) => {
    if (isUsername(name)) expect(accepts(api, name)).toBe(true);
  });
  it('refuses the names the API refuses (a leading dot, dash or underscore)', () => {
    for (const name of ['.casey', '-casey', '_casey']) expect(isUsername(name), name).toBe(false);
  });
});

describe('product form: what passes is what the API takes', () => {
  const ok: ProductValues = { ...EMPTY_PRODUCT, name: 'Olive wood cross', price: '19.5', img: 'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&token=1' };

  it('image addresses: never one the API refuses', () => {
    for (const address of ['https://x.example/a.jpg', 'https://x.example/a b.jpg', 'https://x.example/a".jpg', 'https://x.example/a<b>.jpg', 'https://x.example/a\\b.jpg', 'http://localhost:3901/a.svg']) {
      if (isImageUrl(address)) expect(accepts(serverUrl(), sanitised(address)), address).toBe(true);
    }
    expect(isImageUrl('https://x.example/a b.jpg')).toBe(false);
  });

  it('colours: all of them are sent (none dropped), within the API\'s 20 x 50', () => {
    const twenty = Array.from({ length: MAX_COLORS }, (_, i) => `colour ${i}`).join(', ');
    expect(validateProduct({ ...ok, colors: twenty })).toEqual({});
    expect(toBody({ ...ok, colors: twenty }, 'u').color).toHaveLength(MAX_COLORS);
    expect(accepts(serverArrayOf(serverStr({ min: 1, max: MAX_COLOR_LENGTH }), { max: 20 }), parseColors(twenty))).toBe(true);
    expect(validateProduct({ ...ok, colors: `${twenty}, one more` }).colors).toBe('colors');
    expect(validateProduct({ ...ok, colors: 'x'.repeat(MAX_COLOR_LENGTH) }).colors).toBeUndefined();
    expect(validateProduct({ ...ok, colors: `${'x'.repeat(MAX_COLOR_LENGTH - 1)}&` }).colors).toBe('colors');
  });

  it('name and description are measured as the API measures them ("&" is stored as "&amp;")', () => {
    expect(storedLength('Fish & Loaves')).toBe(17);
    const description = `${'x'.repeat(1999)}&`;
    expect(accepts(serverStr({ min: 0, max: 2000, multiline: true }), sanitised(description))).toBe(false);
    expect(validateProduct({ ...ok, description }).description).toBe('description');
    expect(validateProduct({ ...ok, name: `${'n'.repeat(199)}&` }).name).toBe('name');
    expect(validateProduct({ ...ok, name: 'Fish & Loaves Plate', description: 'Olive wood & glass' })).toEqual({});
  });
});

describe('site reviews: where the reviewer is from, never shown as an e-mail address', () => {
  it('reads place, else an old review\'s email that is not an address', () => {
    expect(reviewerPlace({ place: 'Italy', email: '' })).toBe('Italy');
    expect(reviewerPlace({ email: 'Germany' })).toBe('Germany');
    expect(reviewerPlace({ email: 'anna@example.com' })).toBe('');
    expect(reviewerEmail({ email: 'Germany' })).toBe('');
    expect(reviewerEmail({ email: 'anna@example.com' })).toBe('anna@example.com');
  });
});
