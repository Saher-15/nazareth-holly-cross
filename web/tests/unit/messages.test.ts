import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/routing';

type Messages = { [key: string]: string | Messages };

const load = (locale: string): Messages =>
  JSON.parse(readFileSync(join(__dirname, '../../src/messages', `${locale}.json`), 'utf8'));

const flatten = (obj: Messages, prefix = ''): Record<string, string> =>
  Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) };
  }, {});

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const english = flatten(load('en'));

describe.each(locales)('messages/%s.json', (locale) => {
  const messages = flatten(load(locale));

  it('has every key that English has, and no others', () => {
    expect(Object.keys(messages).filter((k) => !(k in english))).toEqual([]);
    expect(Object.keys(english).filter((k) => !(k in messages))).toEqual([]);
  });

  it('keeps the same placeholders as English', () => {
    const wrong = Object.keys(english).filter(
      (k) => k in messages && placeholders(messages[k]).join() !== placeholders(english[k]).join(),
    );
    expect(wrong).toEqual([]);
  });

  it('contains only valid ICU messages', () => {
    const broken = Object.entries(messages).filter(([, text]) => {
      try {
        new IntlMessageFormat(text, locale);
        return false;
      } catch {
        return true;
      }
    });
    expect(broken.map(([k]) => k)).toEqual([]);
  });
});
