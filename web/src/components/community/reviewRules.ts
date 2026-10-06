// Logic of the share-a-review form (ReviewForm.tsx), kept free of React so it can be unit tested.

import { COUNTRY_CODES, countryName } from '@/components/checkout/countries';
import { storedLength } from '@/lib/formRules';

export type ReviewField = 'fullName' | 'place' | 'msg';
export type ReviewValues = Record<ReviewField, string>;

export type FieldErrorKey =
  | 'nameRequired'
  | 'nameTooShort'
  | 'placeRequired'
  | 'messageRequired'
  | 'messageTooShort'
  | 'tooLong';
export type FieldError = { key: FieldErrorKey; values?: { min?: number; max?: number } };
export type ReviewErrors = Partial<Record<ReviewField, FieldError>>;

export type SubmitErrorKey = 'rateLimited' | 'invalid' | 'network' | 'server';

/** The order fields appear in, which is also the order they get focus when invalid. */
export const REVIEW_FIELDS: readonly ReviewField[] = ['fullName', 'place', 'msg'];

export const emptyReview: ReviewValues = { fullName: '', place: '', msg: '' };

// Same limits as the API's Review model (server/model/review.js), so the API never rejects what passes here.
// The place is optional for the API but was required by the CRA form, and still is.
export const REVIEW_RULES: Record<ReviewField, { min: number; max: number; required: FieldErrorKey; tooShort?: FieldErrorKey }> = {
  fullName: { min: 2, max: 200, required: 'nameRequired', tooShort: 'nameTooShort' },
  place: { min: 1, max: 200, required: 'placeRequired' },
  msg: { min: 3, max: 1000, required: 'messageRequired', tooShort: 'messageTooShort' },
};

export function validateField(field: ReviewField, raw: string): FieldError | undefined {
  const value = raw.trim();
  const rule = REVIEW_RULES[field];
  // The place is a country chosen from the list (an ISO 3166-1 code), never typed.
  if (field === 'place') return COUNTRY_CODES.includes(value) ? undefined : { key: rule.required };
  if (!value) return { key: rule.required };
  if (rule.tooShort && value.length < rule.min) return { key: rule.tooShort, values: { min: rule.min } };
  // The model checks the length of the text as stored ("&" is saved as "&amp;"), lib/formRules.ts.
  if (storedLength(value) > rule.max) return { key: 'tooLong', values: { max: rule.max } };
  return undefined;
}

export function validateReview(values: ReviewValues): ReviewErrors {
  const errors: ReviewErrors = {};
  for (const field of REVIEW_FIELDS) {
    const error = validateField(field, values[field]);
    if (error) errors[field] = error;
  }
  return errors;
}

export function firstInvalidField(errors: ReviewErrors): ReviewField | undefined {
  return REVIEW_FIELDS.find((field) => errors[field]);
}

/** The body POST /review/addReview expects: the country's English name in the API's `place` field. */
export function toReviewPayload(values: ReviewValues) {
  const place = values.place.trim();
  return {
    fullName: values.fullName.trim(),
    place: COUNTRY_CODES.includes(place) ? countryName(place, 'en') : place,
    msg: values.msg.trim(),
  };
}

/** Which message to show when the API refused the review (status 0 = no answer at all). */
export function submitErrorKey(status: number): SubmitErrorKey {
  if (status === 429) return 'rateLimited';
  if (status === 0) return 'network';
  if (status >= 400 && status < 500) return 'invalid';
  return 'server';
}
