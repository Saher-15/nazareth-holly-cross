// Rules of the contact form (/contact), free of React so they can be unit tested. The API
// (server/route/contactRoute.js, POST /contact/contact_us_request) requires fullName, email, phone and msg (the route
// requires the phone although the model makes it optional) and checks the address with its strict isEmail; the model
// caps them at 200, 500, 50 and 2000 characters, counted as stored (lib/formRules.ts). docs/FORM-CONTRACTS.md.

import { isApiEmail, storedLength } from '@/lib/formRules';

export type ContactField = 'fullName' | 'email' | 'phone' | 'msg';
export type ContactValues = Record<ContactField, string>;
export type ContactErrorKey = 'required' | 'tooShort' | 'tooLong' | 'invalidEmail' | 'invalidPhone';
export type ContactFieldError = { key: ContactErrorKey; values?: { min?: number; max?: number } };
export type ContactErrors = Partial<Record<ContactField, ContactFieldError>>;
export type ContactSubmitError = 'rateLimited' | 'invalid' | 'network' | 'server';

export const CONTACT_FIELDS: readonly ContactField[] = ['fullName', 'email', 'phone', 'msg'];
export const emptyContact: ContactValues = { fullName: '', email: '', phone: '', msg: '' };

export const CONTACT_RULES: Record<ContactField, { min: number; max: number }> = {
  fullName: { min: 2, max: 200 },
  email: { min: 5, max: 254 },
  phone: { min: 5, max: 50 },
  msg: { min: 3, max: 2000 },
};

// Digits with the usual separators and an optional leading plus: +972 4 123 4567, (04) 123-4567.
const PHONE = /^\+?[\d\s().-]{5,}$/;

export function validateContactField(field: ContactField, raw: string): ContactFieldError | undefined {
  const value = raw.trim();
  const rule = CONTACT_RULES[field];
  if (!value) return { key: 'required' };
  if (storedLength(value) > rule.max) return { key: 'tooLong', values: { max: rule.max } };
  if (field === 'email' && !isApiEmail(value)) return { key: 'invalidEmail' };
  if (field === 'phone' && (!PHONE.test(value) || (value.match(/\d/g)?.length ?? 0) < 5)) return { key: 'invalidPhone' };
  if ((field === 'fullName' || field === 'msg') && value.length < rule.min) {
    return { key: 'tooShort', values: { min: rule.min } };
  }
  return undefined;
}

export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  for (const field of CONTACT_FIELDS) {
    const error = validateContactField(field, values[field]);
    if (error) errors[field] = error;
  }
  return errors;
}

export const firstInvalidContactField = (errors: ContactErrors) => CONTACT_FIELDS.find((f) => errors[f]);

export const toContactPayload = (values: ContactValues) => ({
  fullName: values.fullName.trim(),
  email: values.email.trim(),
  phone: values.phone.trim(),
  msg: values.msg.trim(),
});

/** Which message to show when the API refused the message (status 0 = no answer at all). */
export function contactSubmitError(status: number): ContactSubmitError {
  if (status === 429) return 'rateLimited';
  if (status === 0) return 'network';
  if (status >= 400 && status < 500) return 'invalid';
  return 'server';
}

/** A link that opens a chat with the given WhatsApp number (digits only, with country code), or null. */
export function whatsappUrl(number: string): string | null {
  const digits = number.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}
