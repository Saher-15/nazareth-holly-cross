import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/routing';

type Messages = { [key: string]: string | Messages };
// The parsed ICU tree, read loosely: numeric node types 0 literal, 1 argument, 2 number, 3 date, 4 time,
// 5 select, 6 plural, 7 "#", 8 tag.
type Node = { type: number; value?: string; options?: Record<string, { value: Node[] }>; children?: Node[] };
const parse = (text: string, locale: string) => new IntlMessageFormat(text, locale).getAst() as unknown as Node[];

const load = (locale: string): Messages =>
  JSON.parse(readFileSync(join(__dirname, '../../src/messages', `${locale}.json`), 'utf8'));

const flatten = (obj: Messages, prefix = ''): Record<string, string> =>
  Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) };
  }, {});

/** Every variable and tag a message uses, read from its parsed ICU tree (so plural branches count too). */
function names(nodes: Node[]): string[] {
  return nodes.flatMap((n): string[] => {
    if (n.type === 0 || n.type === 7) return [];
    const inner = Object.values(n.options ?? {}).flatMap((o) => names(o.value));
    return [n.value ?? '', ...inner, ...names(n.children ?? [])];
  });
}
const placeholders = (text: string, locale: string) => [...new Set(names(parse(text, locale)))].sort();

/** The plural nodes of a message, so each language can be checked for the categories it needs. */
function pluralNodes(nodes: Node[]): Node[] {
  return nodes.flatMap((n): Node[] => [
    ...(n.type === 6 ? [n] : []),
    ...Object.values(n.options ?? {}).flatMap((o) => pluralNodes(o.value)),
    ...pluralNodes(n.children ?? []),
  ]);
}

const english = flatten(load('en'));

// Strings that are deliberately the same as the English text (brand, icon classes, e-mail, numbers).
const SAME_AS_ENGLISH = new Set([
  'site.name',
  'heroSection.shopIcon',
  'heroSection.tourIcon',
  'footer.email',
  'footer.creditLink1',
  'footer.creditLink2',
  'communityPage.reviews.form.counter',
  'shopFeatures.reviews.form.counter',
  'pilgrim.prayers.form.counter',
  'pilgrim.contact.form.counter',
  'email',
  'paypalComponent.email',
]);

// The plural categories a message must spell out. Anything left out would silently fall back to
// "other", which is wrong in these languages (e.g. Russian 2 and 5 take different forms).
const REQUIRED_PLURAL_FORMS: Record<string, string[]> = {
  ru: ['one', 'few', 'many'],
  uk: ['one', 'few', 'many'],
  pl: ['one', 'few', 'many'],
  ar: ['one', 'two', 'few', 'many'],
  ro: ['one', 'few'],
};

const NATIVE_SCRIPT: Record<string, RegExp> = {
  ru: /\p{Script=Cyrillic}/u,
  uk: /\p{Script=Cyrillic}/u,
  el: /\p{Script=Greek}/u,
  he: /\p{Script=Hebrew}/u,
  ar: /\p{Script=Arabic}/u,
};

describe.each(locales)('messages/%s.json', (locale) => {
  const messages = flatten(load(locale));

  it('has every key that English has, and no others', () => {
    expect(Object.keys(messages).filter((k) => !(k in english))).toEqual([]);
    expect(Object.keys(english).filter((k) => !(k in messages))).toEqual([]);
  });

  it('keeps the same placeholders as English (also inside plural and select branches)', () => {
    const wrong = Object.keys(english).filter(
      (k) => k in messages && placeholders(messages[k], locale).join() !== placeholders(english[k], 'en').join(),
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

  it('spells out every plural form the language uses', () => {
    const required = REQUIRED_PLURAL_FORMS[locale] ?? [];
    const incomplete = Object.entries(messages).flatMap(([key, text]) =>
      pluralNodes(parse(text, locale))
        .filter((node) => !node.options || !('other' in node.options) || required.some((form) => !(form in (node.options ?? {}))))
        .map(() => key),
    );
    expect(incomplete).toEqual([]);
  });

  it('uses Western digits only (the site shows 0-9 in every language)', () => {
    const offenders = Object.entries(messages)
      .filter(([, text]) => /[٠-٩۰-۹]/.test(text))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('has no zero-width, stray or doubled spaces', () => {
    const offenders = Object.entries(messages)
      .filter(([, text]) => /[​﻿]/.test(text) || / {2,}/.test(text) || text !== text.trim())
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it.skipIf(locale === 'en')('uses typographic apostrophes between letters (a straight one can start an ICU quote)', () => {
    const offenders = Object.entries(messages)
      .filter(([, text]) => /\p{L}'\p{L}/u.test(text))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  if (locale !== 'en') {
    it('is translated (no English left over)', () => {
      const offenders = Object.entries(messages)
        .filter(([key, text]) => text === english[key] && /[A-Za-z]{4,}/.test(text) && !SAME_AS_ENGLISH.has(key))
        // Short labels and plural forms that really are the same word in English and in the language
        // (total, contact, minutes, 1 photo ...) are fine in a Latin-script language.
        .filter(([, text]) => NATIVE_SCRIPT[locale] || (!text.includes(', plural,') && text.split(/\s+/).length > 3))
        .map(([key]) => key);
      expect(offenders).toEqual([]);
    });
  }

  const script = NATIVE_SCRIPT[locale];
  if (script) {
    it('does not mix Latin letters into native-script words (no "Сhurch" or "Мариa")', () => {
      const offenders = Object.entries(messages).flatMap(([key, text]) =>
        text
          .replace(/\{[^}]*\}|<[^>]*>/g, ' ')
          .split(/[\s⁦-⁩־.,;:!?()«»„“”"'’‘—–\-/·…]+/)
          .filter((word) => script.test(word) && /[A-Za-z]/.test(word))
          .map((word) => `${key}: ${word}`),
      );
      expect(offenders).toEqual([]);
    });
  }
});

describe('message files across languages', () => {
  it('lists each locale file once in the routing configuration', () => {
    expect(new Set(locales).size).toBe(locales.length);
  });
});
