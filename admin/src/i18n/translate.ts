import { en, type MessageKey } from './messages/en';
import { he } from './messages/he';
import { ar } from './messages/ar';
import type { Locale } from './locales';

export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

const catalogs: Record<Locale, Partial<Record<MessageKey, string>>> = { en, he, ar };

/** The messages of one locale with English filling any gap, so a missing translation never shows a raw key. */
export function messagesFor(locale: Locale): Record<MessageKey, string> {
  return { ...en, ...catalogs[locale] };
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

export function makeTranslate(messages: Record<MessageKey, string>): Translate {
  return (key, vars) => interpolate(messages[key] ?? key, vars);
}

export function translatorFor(locale: Locale): Translate {
  return makeTranslate(messagesFor(locale));
}
