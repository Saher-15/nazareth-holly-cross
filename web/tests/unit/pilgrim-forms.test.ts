import { describe, expect, it } from 'vitest';
import {
  contactSubmitError,
  emptyContact,
  validateContact,
  validateContactField,
  whatsappUrl,
} from '@/data/pilgrim/contact';
import {
  categoryKey,
  containsLinkOrMarkup,
  displayText,
  emptyPrayer,
  isCategory,
  PRAYER_CATEGORIES,
  prayerSubmitError,
  toPrayerPayload,
  validatePrayer,
  wallCountry,
} from '@/data/pilgrim/prayers';
import { normalize, searchEntries, snippet, tokens, type SearchEntry } from '@/lib/search';

describe('prayer form', () => {
  it('takes the country from the list only and sends its English name, which the server model stores as text', () => {
    expect(validatePrayer({ ...emptyPrayer, name: 'Maria', country: 'Italy', prayer: 'Peace for all families.' }).country?.key).toBe('required');
    expect(validatePrayer({ ...emptyPrayer, name: 'Maria', country: 'XX', prayer: 'Peace for all families.' }).country?.key).toBe('required');
    expect(toPrayerPayload({ ...emptyPrayer, name: 'Anna', country: 'DE', prayer: 'Peace.' }).country).toBe('Germany');
    // The payload has exactly the fields of server/model/prayer.js.
    expect(Object.keys(toPrayerPayload({ ...emptyPrayer, country: 'IL' })).sort()).toEqual(['category', 'country', 'name', 'prayer']);
  });

  it('shows a known country in the language of the reader and keeps older free-text countries', () => {
    expect(wallCountry('Germany', 'de')).toBe('Deutschland');
    expect(wallCountry('germany ', 'fr')).toBe('Allemagne');
    expect(wallCountry('Nazareth', 'he')).toBe('Nazareth');
    expect(wallCountry('see www.spam.example', 'en')).not.toContain('www.');
  });


  const good = { ...emptyPrayer, name: 'Maria', country: 'IT', prayer: 'Peace for all families.' };

  it('accepts a normal prayer and trims it for the API', () => {
    expect(validatePrayer(good)).toEqual({});
    expect(toPrayerPayload({ ...good, name: '  Maria ' })).toEqual({
      name: 'Maria',
      country: 'Italy',
      prayer: 'Peace for all families.',
      category: 'Personal',
    });
  });

  it('flags empty, short, long and link-bearing fields', () => {
    expect(validatePrayer(emptyPrayer)).toEqual({
      name: { key: 'required' },
      country: { key: 'required' },
      prayer: { key: 'required' },
    });
    expect(validatePrayer({ ...good, prayer: 'Hi' }).prayer?.key).toBe('tooShort');
    expect(validatePrayer({ ...good, prayer: 'x'.repeat(1001) }).prayer?.key).toBe('tooLong');
    expect(validatePrayer({ ...good, prayer: 'Visit https://spam.example now' }).prayer?.key).toBe('noLinks');
    expect(validatePrayer({ ...good, name: '<b>Maria</b>' }).name?.key).toBe('noLinks');
  });

  it('detects links, e-mail addresses and markup but not ordinary text', () => {
    for (const bad of ['www.example.com', 'call me: me@mail.com', 'shop.biz', '<script>alert(1)</script>']) {
      expect(containsLinkOrMarkup(bad)).toBe(true);
    }
    for (const fine of ['Lord, hear our prayer.', 'Thanks for 3 healthy children.', 'שלום לכולם', 'ربنا يحفظكم']) {
      expect(containsLinkOrMarkup(fine)).toBe(false);
    }
  });

  it('knows the API categories and their message keys', () => {
    expect(PRAYER_CATEGORIES.map(categoryKey)).toEqual(['peace', 'health', 'gratitude', 'family', 'personal', 'worldPeace']);
    expect(isCategory('World Peace')).toBe(true);
    expect(isCategory('world peace')).toBe(false);
    expect(isCategory(undefined)).toBe(false);
  });

  it('shows wall text safely: no addresses, no control characters, no runaway length', () => {
    expect(displayText('Pray at https://evil.example/x or mail a@b.co please')).toBe('Pray at … or mail … please');
    expect(displayText('a\u0000b‮c\r\n\r\n\r\n\r\nd')).toBe('abc\n\nd');
    expect(displayText('x'.repeat(2000), 50)).toHaveLength(51);
    expect(displayText('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>'); // plain text: React escapes it
  });

  it('maps API refusals to messages', () => {
    expect(prayerSubmitError(429)).toBe('rateLimited');
    expect(prayerSubmitError(0)).toBe('network');
    expect(prayerSubmitError(400)).toBe('invalid');
    expect(prayerSubmitError(500)).toBe('server');
  });
});

describe('contact form', () => {
  const good = { fullName: 'Maria Rossi', email: 'maria@example.com', phone: '+39 312 345 6789', msg: 'Hello there' };

  it('accepts what the API accepts', () => {
    expect(validateContact(good)).toEqual({});
  });

  it('requires all four fields, like the API', () => {
    expect(Object.keys(validateContact(emptyContact))).toEqual(['fullName', 'email', 'phone', 'msg']);
  });

  it('validates e-mail and phone formats', () => {
    expect(validateContactField('email', 'no-at-sign')?.key).toBe('invalidEmail');
    expect(validateContactField('email', 'a@b.co')).toBeUndefined();
    expect(validateContactField('phone', 'abc')?.key).toBe('invalidPhone');
    expect(validateContactField('phone', '12')?.key).toBe('invalidPhone');
    expect(validateContactField('phone', '(04) 123-4567')).toBeUndefined();
    expect(validateContactField('msg', 'ab')?.key).toBe('tooShort');
    expect(validateContactField('msg', 'x'.repeat(2001))?.key).toBe('tooLong');
  });

  it('treats a 429 as rate limiting and builds WhatsApp links only from a real number', () => {
    expect(contactSubmitError(429)).toBe('rateLimited');
    expect(contactSubmitError(422)).toBe('invalid');
    expect(whatsappUrl('')).toBeNull();
    expect(whatsappUrl('+972 50-123-4567')).toBe('https://wa.me/972501234567');
  });
});

describe('site search', () => {
  const entries: SearchEntry[] = [
    { id: 'a', type: 'page', title: 'Prayer wall', text: 'Read prayers from pilgrims', href: '/prayers' },
    { id: 'b', type: 'site', title: "Mary's Well", text: 'Ancient spring where Mary drew water', href: '/sites/maryswell' },
    { id: 'c', type: 'faq', title: 'How much is shipping?', text: 'A flat fee per order', href: '/faq#shop-shipping' },
    { id: 'd', type: 'page', title: 'Plan your pilgrimage', text: 'Day-by-day itinerary', href: '/plan' },
  ];

  it('ignores case, accents and marks', () => {
    expect(normalize('  Nazaré  ')).toBe('nazare');
    expect(normalize('מִרְיָם')).toBe('מרים');
    expect(tokens('Mary  Well')).toEqual(['mary', 'well']);
  });

  it('ranks title matches above text matches and needs every word', () => {
    expect(searchEntries(entries, 'pray').map((e) => e.id)).toEqual(['a']);
    expect(searchEntries(entries, 'pilgrim').map((e) => e.id)).toEqual(['d', 'a']);
    expect(searchEntries(entries, 'mary water').map((e) => e.id)).toEqual(['b']);
    expect(searchEntries(entries, 'mary zzz')).toEqual([]);
    expect(searchEntries(entries, '   ')).toEqual([]);
  });

  it('cuts a snippet around the match', () => {
    const text = `${'word '.repeat(60)}needle ${'word '.repeat(60)}`;
    const part = snippet(text, 'needle', 60);
    expect(part).toContain('needle');
    expect(part.length).toBeLessThanOrEqual(64);
  });
});
