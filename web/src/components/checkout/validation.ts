// Form rules for the checkout, candle and donation flows.
//
// PayPal takes the money *before* the order or candle request is saved, so anything the
// API would refuse afterwards (server/route/orderRoute.js, server/route/candleRoute.js,
// server/model/*.js, server/services/pricing.js) must be caught here, before the visitor pays.

import { isApiEmail, storedLength } from '@/lib/formRules';

// Maximum lengths, from the API models. They are compared with the length the API stores (lib/formRules.ts,
// storedLength: "&" counts as the 5 characters of "&amp;"), since the models check that one.
export const LIMITS = {
  name: 100,
  email: 254,
  phone: 50,
  street: 200,
  city: 100,
  state: 100,
  postal: 20,
  // The API stores "<church>, <prayer>" and refuses more than 1000 characters in total.
  prayer: 900,
} as const;

export type FieldError = 'required' | 'tooLong' | 'email' | 'emailMismatch' | 'phone' | 'church' | 'amount';
export type FormErrors<K extends string> = Partial<Record<K, FieldError>>;

function text(value: string, max: number): FieldError | undefined {
  const v = value.trim();
  if (!v) return 'required';
  if (storedLength(v) > max) return 'tooLong';
  return undefined;
}

// The API's own address check (server/utils/validate.js isEmail), not a looser one: an address the API refuses would
// only be found out after the payment.
function email(value: string): FieldError | undefined {
  return text(value, LIMITS.email) ?? (isApiEmail(value) ? undefined : 'email');
}

// The API lowercases e-mail addresses, so "Anna@x.com" and "anna@x.com" are the same.
function confirmation(value: string, original: string): FieldError | undefined {
  if (!value.trim()) return 'required';
  return value.trim().toLowerCase() === original.trim().toLowerCase() ? undefined : 'emailMismatch';
}

// Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits, as typed on Arabic and Persian keyboards,
// become 0-9: the team reads the number and the API stores it as written.
export const asciiDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

// Digits with the usual separators: "+972 52-123 4567", "(555) 010-2030".
export function isPhone(value: string): boolean {
  const v = asciiDigits(value.trim());
  if (!/^\+?[\d\s().-]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, '').length;
  return digits >= 6 && digits <= 20;
}

function compact<K extends string>(errors: Record<K, FieldError | undefined>): FormErrors<K> {
  return Object.fromEntries(Object.entries(errors).filter(([, e]) => e)) as FormErrors<K>;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;

/* ---- shop order: contact + delivery ---- */

export type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  country: string; // ISO 3166 region code, e.g. "IL"
  street: string;
  city: string;
  state: string;
  postal: string;
};

export const emptyContact: ContactForm = {
  firstName: '',
  lastName: '',
  email: '',
  confirmEmail: '',
  phone: '',
  country: '',
  street: '',
  city: '',
  state: '',
  postal: '',
};

export function validateContact(f: ContactForm): FormErrors<keyof ContactForm> {
  return compact<keyof ContactForm>({
    firstName: text(f.firstName, LIMITS.name),
    lastName: text(f.lastName, LIMITS.name),
    email: email(f.email),
    confirmEmail: confirmation(f.confirmEmail, f.email),
    phone: text(f.phone, LIMITS.phone) ?? (isPhone(f.phone) ? undefined : 'phone'),
    country: f.country ? undefined : 'required',
    street: text(f.street, LIMITS.street),
    city: text(f.city, LIMITS.city),
    state: text(f.state, LIMITS.state),
    postal: text(f.postal, LIMITS.postal),
  });
}

type OrderLine = { _id: string; name: string; quantity: number; color: string };

// Body of POST /order/newOrder (same shape the current site sends). The API recomputes
// the total from the database; totalPrice is informational.
export function buildOrderBody(f: ContactForm, lines: OrderLine[], totalPrice: number, countryName: string) {
  return {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    phone: asciiDigits(f.phone.trim()),
    email: f.email.trim(),
    street: f.street.trim(),
    city: f.city.trim(),
    state: f.state.trim(),
    postal: f.postal.trim(),
    country: countryName,
    totalPrice,
    products: lines.map((l) => ({ productID: l._id, productName: l.name, quantity: l.quantity, color: l.color })),
  };
}

/* ---- prayer candle ---- */

// The value is written into the prayer text the team reads, so it stays in English.
export const CHURCHES = ['Annunciation church', 'Greek orthodox church'] as const;
export type Church = (typeof CHURCHES)[number];

export type CandleForm = {
  church: string;
  firstName: string;
  lastName: string;
  email: string;
  confirmEmail: string;
  prayer: string;
};

export const emptyCandle: CandleForm = {
  church: '',
  firstName: '',
  lastName: '',
  email: '',
  confirmEmail: '',
  prayer: '',
};

export function validateCandle(f: CandleForm): FormErrors<keyof CandleForm> {
  return compact<keyof CandleForm>({
    church: (CHURCHES as readonly string[]).includes(f.church) ? undefined : 'church',
    firstName: text(f.firstName, LIMITS.name),
    lastName: text(f.lastName, LIMITS.name),
    email: email(f.email),
    confirmEmail: confirmation(f.confirmEmail, f.email),
    prayer: text(f.prayer, LIMITS.prayer),
  });
}

// Body of POST /candle/lightACandle, exactly as the current site sends it.
export function buildCandleBody(f: CandleForm) {
  return {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    email: f.email.trim(),
    prayer: `${f.church}, ${f.prayer.trim()}`,
  };
}

/* ---- donation ---- */

// Same limits as server/services/pricing.js.
export const DONATION_MIN = 1;
export const DONATION_MAX = 5000;
export const DONATION_PRESETS = [10, 25, 50, 100] as const;

// "25", "25.5", "25,50" and Arabic-Indic digits ("٢٥") all read as dollars; at most 2 decimals.
export function parseAmount(input: string): number | null {
  const v = asciiDigits(input.trim()).replace(/[,٫]/, '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) return null;
  return Number(v);
}

export type DonationForm = {
  name: string;
  preset: number | 'other';
  custom: string;
};

export const emptyDonation: DonationForm = { name: '', preset: 25, custom: '' };

export function donationAmount(f: DonationForm): number | null {
  return f.preset === 'other' ? parseAmount(f.custom) : f.preset;
}

export function validateDonation(f: DonationForm): FormErrors<'name' | 'amount'> {
  const amount = donationAmount(f);
  let amountError: FieldError | undefined;
  if (amount === null) amountError = f.preset === 'other' && !f.custom.trim() ? 'required' : 'amount';
  else if (amount < DONATION_MIN || amount > DONATION_MAX) amountError = 'amount';
  return compact<'name' | 'amount'>({ name: text(f.name, LIMITS.name), amount: amountError });
}
