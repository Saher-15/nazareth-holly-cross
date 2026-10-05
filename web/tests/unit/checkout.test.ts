import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, countryName, countryOptions } from '@/components/checkout/countries';
import {
  buildCandleBody,
  buildOrderBody,
  DONATION_MAX,
  DONATION_MIN,
  donationAmount,
  emptyCandle,
  emptyContact,
  emptyDonation,
  isPhone,
  LIMITS,
  parseAmount,
  validateCandle,
  validateContact,
  validateDonation,
  type ContactForm,
} from '@/components/checkout/validation';

const contact: ContactForm = {
  firstName: ' Maria ',
  lastName: 'Haddad',
  email: 'maria@example.com',
  confirmEmail: 'Maria@Example.com ',
  phone: '+972 52-123 4567',
  country: 'IL',
  street: '1 Paulus VI St',
  city: 'Nazareth',
  state: 'North',
  postal: '16000',
};

describe('validateContact', () => {
  it('accepts a complete address (the e-mail check ignores case and spaces, like the API)', () => {
    expect(validateContact(contact)).toEqual({});
  });

  it('marks every empty field as required', () => {
    const errors = validateContact(emptyContact);
    expect(Object.keys(errors).sort()).toEqual(Object.keys(emptyContact).sort());
    expect(new Set(Object.values(errors))).toEqual(new Set(['required']));
  });

  it('rejects a malformed e-mail, a different confirmation and a bad phone', () => {
    const errors = validateContact({ ...contact, email: 'maria@example', confirmEmail: 'x@y.z', phone: '12-ab' });
    expect(errors).toEqual({ email: 'email', confirmEmail: 'emailMismatch', phone: 'phone' });
  });

  it('refuses values the API would refuse after the payment (length limits)', () => {
    expect(validateContact({ ...contact, postal: '1'.repeat(LIMITS.postal + 1) })).toEqual({ postal: 'tooLong' });
    expect(validateContact({ ...contact, firstName: '   ' })).toEqual({ firstName: 'required' });
  });
});

describe('isPhone', () => {
  it.each(['+972 52-123 4567', '(555) 010-2030', '0521234567'])('accepts %s', (n) => expect(isPhone(n)).toBe(true));
  it.each(['12345', 'call me', '+1 555 CALL', '1'.repeat(21)])('rejects %s', (n) => expect(isPhone(n)).toBe(false));
});

describe('buildOrderBody', () => {
  it('has the shape POST /order/newOrder expects, with trimmed values and the English country name', () => {
    const lines = [{ _id: 'p1', name: 'Olive wood cross', quantity: 2, color: 'brown', price: 10, img: '' }];
    expect(buildOrderBody(contact, lines, 23, 'Israel')).toEqual({
      firstName: 'Maria',
      lastName: 'Haddad',
      phone: '+972 52-123 4567',
      email: 'maria@example.com',
      street: '1 Paulus VI St',
      city: 'Nazareth',
      state: 'North',
      postal: '16000',
      country: 'Israel',
      totalPrice: 23,
      products: [{ productID: 'p1', productName: 'Olive wood cross', quantity: 2, color: 'brown' }],
    });
  });
});

describe('candle', () => {
  const candle = {
    church: 'Greek orthodox church',
    firstName: 'Anna',
    lastName: 'Smith',
    email: 'anna@example.com',
    confirmEmail: 'anna@example.com',
    prayer: ' For my family ',
  };

  it('requires a church from the list', () => {
    expect(validateCandle(candle)).toEqual({});
    expect(validateCandle({ ...candle, church: '' })).toEqual({ church: 'church' });
    expect(validateCandle({ ...candle, church: 'Somewhere else' })).toEqual({ church: 'church' });
    expect(validateCandle(emptyCandle).prayer).toBe('required');
  });

  it('keeps the prayer within what the API stores (church + prayer <= 1000 characters)', () => {
    expect(validateCandle({ ...candle, prayer: 'a'.repeat(LIMITS.prayer + 1) })).toEqual({ prayer: 'tooLong' });
    const longest = buildCandleBody({ ...candle, prayer: 'a'.repeat(LIMITS.prayer) });
    expect(longest.prayer.length).toBeLessThanOrEqual(1000);
  });

  it('sends the same body as the current site: the church in English before the prayer', () => {
    expect(buildCandleBody(candle)).toEqual({
      firstName: 'Anna',
      lastName: 'Smith',
      email: 'anna@example.com',
      prayer: 'Greek orthodox church, For my family',
    });
  });
});

describe('donation', () => {
  it('reads amounts typed in different ways', () => {
    expect(parseAmount('25')).toBe(25);
    expect(parseAmount(' 12.5 ')).toBe(12.5);
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('٢٥')).toBe(25);
    expect(parseAmount('1,000')).toBeNull(); // ambiguous: never read as $1
    expect(parseAmount('12.345')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('uses the preset unless "other" is chosen', () => {
    expect(donationAmount(emptyDonation)).toBe(25);
    expect(donationAmount({ ...emptyDonation, preset: 'other', custom: '40' })).toBe(40);
  });

  it(`accepts ${DONATION_MIN} to ${DONATION_MAX} USD, like the API`, () => {
    const other = (custom: string) => validateDonation({ name: 'Anna', preset: 'other', custom });
    expect(other(String(DONATION_MIN))).toEqual({});
    expect(other(String(DONATION_MAX))).toEqual({});
    expect(other('0.99')).toEqual({ amount: 'amount' });
    expect(other('5000.01')).toEqual({ amount: 'amount' });
    expect(other('')).toEqual({ amount: 'required' });
    expect(other('ten')).toEqual({ amount: 'amount' });
    expect(validateDonation(emptyDonation)).toEqual({ name: 'required' });
  });
});

describe('countries', () => {
  it('lists every ISO 3166 country once', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    expect(COUNTRY_CODES).toContain('IL');
  });

  it('names and sorts countries in the visitor language', () => {
    const fr = countryOptions('fr');
    expect(fr.find((c) => c.code === 'DE')?.name).toBe('Allemagne');
    const names = fr.map((c) => c.name);
    expect(names).toEqual([...names].sort(new Intl.Collator('fr').compare));
    expect(countryOptions('he').find((c) => c.code === 'IL')?.name).toBe('ישראל');
  });

  it('saves orders with the English country name', () => {
    expect(countryName('IL')).toBe('Israel');
    expect(countryName('DE', 'en')).toBe('Germany');
  });
});
