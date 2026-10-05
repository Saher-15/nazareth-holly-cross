'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { dirOf, type Locale } from './locales';
import { makeTranslate, type Translate } from './translate';
import type { MessageKey } from './messages/en';

type Ctx = { locale: Locale; dir: 'ltr' | 'rtl'; t: Translate };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Record<MessageKey, string>; children: ReactNode }) {
  const value = useMemo<Ctx>(() => ({ locale, dir: dirOf(locale), t: makeTranslate(messages) }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n needs <I18nProvider>');
  return ctx;
}
