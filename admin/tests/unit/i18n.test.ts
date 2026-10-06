import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/messages/en';
import { he } from '@/i18n/messages/he';
import { ar } from '@/i18n/messages/ar';
import { dirOf, isLocale, resolveLocale } from '@/i18n/locales';
import { interpolate, messagesFor, translatorFor } from '@/i18n/translate';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('messages', () => {
  const keys = Object.keys(en);

  for (const [name, catalog] of [['he', he], ['ar', ar]] as const) {
    it(`${name}: no invented keys, no empty strings, same placeholders as English`, () => {
      const extra = Object.keys(catalog).filter((k) => !(k in en));
      expect(extra).toEqual([]);
      for (const [key, value] of Object.entries(catalog)) {
        expect(value, key).toBeTruthy();
        expect(placeholders(value as string), key).toEqual(placeholders(en[key as keyof typeof en]));
      }
    });

    it(`${name}: every English key is translated`, () => {
      // A value without letters ("https://...") is the same in every language.
      expect(keys.filter((k) => !(k in catalog) && /\p{L}/u.test(en[k as keyof typeof en].replace(/https/g, '')))).toEqual([]);
    });
  }

  it('hebrew and arabic text is really in those scripts', () => {
    expect(he['nav.orders']).toMatch(/[֐-׿]/);
    expect(ar['nav.orders']).toMatch(/[؀-ۿ]/);
  });

  it('every translation key used in the source exists in English', () => {
    const used = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(entry.name) && !p.includes(`${path.sep}messages${path.sep}`)) {
          const src = fs.readFileSync(p, 'utf8');
          for (const m of src.matchAll(/\bt\(\s*'([a-z]+\.[A-Za-z0-9.]+)'/g)) used.add(m[1]);
        }
      }
    };
    walk(path.join(__dirname, '../../src'));
    expect(used.size).toBeGreaterThan(150);
    expect([...used].filter((k) => !(k in en))).toEqual([]);
  });
});

describe('translate', () => {
  it('fills placeholders, leaves unknown ones visible, falls back to English', () => {
    expect(interpolate('Hi {name}, {n} left', { name: 'Ada', n: 3 })).toBe('Hi Ada, 3 left');
    expect(interpolate('Hi {name}', {})).toBe('Hi {name}');
    expect(interpolate('plain')).toBe('plain');
    expect(translatorFor('en')('common.pageOf', { page: 2, pages: 5 })).toBe('Page 2 of 5');
    expect(translatorFor('he')('common.pageOf', { page: 2, pages: 5 })).toContain('2');
    const messages = messagesFor('he');
    expect(Object.keys(messages)).toHaveLength(Object.keys(en).length);
  });
  it('locales: validation and direction', () => {
    expect(isLocale('he')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(resolveLocale('ar')).toBe('ar');
    expect(resolveLocale('xx')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
    expect(dirOf('he')).toBe('rtl');
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
  });
});
