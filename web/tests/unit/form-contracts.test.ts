import { describe, expect, it } from 'vitest';
// The API's own check, imported from the server code itself so the two can never drift apart unnoticed.
import { isEmail as serverIsEmail } from '../../../server/utils/validate.js';
import { validateCandle, validateContact as validateOrderContact, emptyCandle, LIMITS, type ContactForm } from '@/components/checkout/validation';
import { validateField as validateSiteReviewField } from '@/components/community/reviewRules';
import { validateContactField } from '@/data/pilgrim/contact';
import { asSanitised, isApiEmail, storedLength } from '@/lib/formRules';
import { validateReviewField, emptyReview as emptyProductReview } from '@/lib/shop/reviews';
import { productReviewSchema, productSchema, catalogProductSchema } from '@/lib/api';

// docs/FORM-CONTRACTS.md: every public form must refuse what the API refuses. The order and candle forms are checked
// before PayPal takes the money, so a value that passes here and fails on the API is a paid order that is never saved.

const ADDRESSES = [
  'anna@example.com',
  'Anna.Maria+pilgrims@sub.example.co.il',
  'o\'brien@example.ie',
  'anna@exa_mple.com', // underscore in the domain
  'josé@example.com', // not ASCII
  'anna@example', // no dot in the domain
  'a,b@example.com', // a list
  'anna@-example.com',
  'a&b@example.com', // arrives as a&amp;b@... (the sanitiser), which the API refuses
  'anna @example.com',
  'x'.repeat(65) + '@example.com', // local part over 64
];

describe('isApiEmail agrees with the API (server/utils/validate.js isEmail, after the sanitiser)', () => {
  it.each(ADDRESSES)('%s', (address) => {
    expect(isApiEmail(address)).toBe(serverIsEmail(asSanitised(address)));
  });

  it('refuses the addresses the old pattern let through', () => {
    for (const address of ['anna@exa_mple.com', 'josé@example.com', 'a,b@example.com', 'a&b@example.com']) {
      expect(isApiEmail(address), address).toBe(false);
    }
  });
});

describe('storedLength counts what the sanitiser writes', () => {
  it('"&", "<" and ">" grow; an entity already written out does not', () => {
    // Seen on express-xss-sanitizer: "Tom & Jerry" -> "Tom &amp; Jerry", "<3 you" -> "&lt;3 you", "a&amp;b" unchanged.
    expect(asSanitised('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(asSanitised('<3 you')).toBe('&lt;3 you');
    expect(asSanitised('a&amp;b')).toBe('a&amp;b');
    expect(storedLength('Tom & Jerry')).toBe(15);
    expect(storedLength('plain')).toBe(5);
  });
});

const order: ContactForm = {
  firstName: 'Maria',
  lastName: 'Haddad',
  email: 'maria@example.com',
  confirmEmail: 'maria@example.com',
  phone: '+972 52-123 4567',
  country: 'IL',
  street: '1 Paulus VI St',
  city: 'Nazareth',
  state: 'North',
  postal: '16000',
};

describe('checkout and candle: nothing the API refuses after the payment', () => {
  it('an address the API refuses is refused before paying', () => {
    expect(validateOrderContact({ ...order, email: 'maria@exa_mple.com', confirmEmail: 'maria@exa_mple.com' })).toEqual({ email: 'email' });
    const candle = { ...emptyCandle, church: 'Annunciation church', firstName: 'A', lastName: 'B', email: 'josé@example.com', confirmEmail: 'josé@example.com', prayer: 'Peace' };
    expect(validateCandle(candle)).toEqual({ email: 'email' });
  });

  it('a street at the limit with an "&" is too long (the API stores it as "&amp;")', () => {
    const street = `${'a'.repeat(LIMITS.street - 3)} & `.trim();
    expect(street.length).toBeLessThanOrEqual(LIMITS.street);
    expect(validateOrderContact({ ...order, street })).toEqual({ street: 'tooLong' });
    expect(validateOrderContact({ ...order, street: 'Paulus VI & Casa Nova St' })).toEqual({});
  });

  it('a candle prayer full of "&" is too long', () => {
    const candle = { ...emptyCandle, church: 'Annunciation church', firstName: 'A', lastName: 'B', email: 'a@b.co', confirmEmail: 'a@b.co' };
    expect(validateCandle({ ...candle, prayer: '&'.repeat(200) })).toEqual({ prayer: 'tooLong' });
    expect(validateCandle({ ...candle, prayer: 'Peace & health' })).toEqual({});
  });
});

describe('contact and reviews', () => {
  it('the contact form uses the API address check and the stored length', () => {
    expect(validateContactField('email', 'anna@exa_mple.com')?.key).toBe('invalidEmail');
    expect(validateContactField('email', 'anna@example.com')).toBeUndefined();
    expect(validateContactField('msg', `${'x'.repeat(1998)}&`)?.key).toBe('tooLong');
  });

  it('a site review and a product review count "&" as stored', () => {
    expect(validateSiteReviewField('msg', `${'x'.repeat(999)}&`)?.key).toBe('tooLong');
    expect(validateSiteReviewField('msg', 'Peace & joy')).toBeUndefined();
    expect(validateReviewField('comment', { ...emptyProductReview, comment: `${'x'.repeat(997)}<3` })?.key).toBe('tooLong');
    expect(validateReviewField('title', { ...emptyProductReview, title: 'Love it <3' })).toBeUndefined();
  });
});

describe('what the API sends back is shown as typed (it stores "&" as "&amp;")', () => {
  const raw = { _id: 'x', name: 'Fish &amp; Loaves Plate', price: 27, img: 'https://a/b', description: 'Olive wood &amp; glass', color: ['Red &amp; gold'] };

  it('product name, description and colours', () => {
    expect(productSchema.parse(raw)).toMatchObject({ name: 'Fish & Loaves Plate', description: 'Olive wood & glass', color: ['Red & gold'] });
    expect(catalogProductSchema.parse({ ...raw, category: 'gifts' })).toMatchObject({ name: 'Fish & Loaves Plate' });
  });

  it('product reviews', () => {
    const review = productReviewSchema.parse({ name: 'Tom &amp; Ann', country: 'Trinidad &amp; Tobago', rating: 5, title: 'Lovely &lt;3', comment: 'Wood &amp; glass' });
    expect(review).toMatchObject({ name: 'Tom & Ann', country: 'Trinidad & Tobago', title: 'Lovely <3', comment: 'Wood & glass' });
  });

  it('decodes once: "&amp;lt;" stays "&lt;"', () => {
    expect(productSchema.parse({ ...raw, name: '&amp;lt;b&amp;gt;' }).name).toBe('&lt;b&gt;');
  });
});
