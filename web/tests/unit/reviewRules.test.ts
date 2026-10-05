import { describe, expect, it } from 'vitest';
import {
  emptyReview,
  firstInvalidField,
  submitErrorKey,
  toReviewPayload,
  validateField,
  validateReview,
} from '@/components/community/reviewRules';
import { scriptOf } from '@/components/community/ReviewWall';
import { serializeJsonLd } from '@/lib/jsonld';
import { reviewerPlace } from '@/lib/reviews';

const good = { fullName: 'Maria Rossi', place: 'Rome, Italy', msg: 'A blessed visit, thank you.' };

describe('validateReview', () => {
  it('accepts a complete review', () => {
    expect(validateReview(good)).toEqual({});
  });

  it('flags every empty field, ignoring spaces', () => {
    expect(validateReview({ fullName: '  ', place: '', msg: '\n' })).toEqual({
      fullName: { key: 'nameRequired' },
      place: { key: 'placeRequired' },
      msg: { key: 'messageRequired' },
    });
  });

  it('applies the API limits (name 2-200, place up to 200, message 3-1000)', () => {
    expect(validateField('fullName', 'A')).toEqual({ key: 'nameTooShort', values: { min: 2 } });
    expect(validateField('msg', 'ok')).toEqual({ key: 'messageTooShort', values: { min: 3 } });
    expect(validateField('place', 'x'.repeat(201))).toEqual({ key: 'tooLong', values: { max: 200 } });
    expect(validateField('msg', 'x'.repeat(1001))).toEqual({ key: 'tooLong', values: { max: 1000 } });
    expect(validateField('msg', 'x'.repeat(1000))).toBeUndefined();
  });

  it('names the first invalid field in form order', () => {
    expect(firstInvalidField(validateReview({ ...good, msg: '' }))).toBe('msg');
    expect(firstInvalidField(validateReview(emptyReview))).toBe('fullName');
    expect(firstInvalidField({})).toBeUndefined();
  });
});

describe('toReviewPayload', () => {
  it('sends trimmed values and keeps the place in the API field "email"', () => {
    expect(toReviewPayload({ fullName: ' Maria ', place: ' Rome ', msg: ' Thank you \n' })).toEqual({
      fullName: 'Maria',
      email: 'Rome',
      msg: 'Thank you',
    });
  });
});

describe('submitErrorKey', () => {
  it('maps API answers to a message', () => {
    expect(submitErrorKey(429)).toBe('rateLimited');
    expect(submitErrorKey(0)).toBe('network');
    expect(submitErrorKey(400)).toBe('invalid');
    expect(submitErrorKey(413)).toBe('invalid');
    expect(submitErrorKey(500)).toBe('server');
    expect(submitErrorKey(503)).toBe('server');
  });
});

describe('reviewerPlace', () => {
  it('shows the place but never an e-mail address stored by older forms', () => {
    expect(reviewerPlace({ email: ' Nazareth ' })).toBe('Nazareth');
    expect(reviewerPlace({ email: 'someone@example.com' })).toBe('');
  });
});

describe('scriptOf', () => {
  it('spots Hebrew and Arabic text so it gets its own typeface on any page', () => {
    expect(scriptOf('תודה רבה')).toBe('hebrew');
    expect(scriptOf('Thanks from Nazareth — شكرا')).toBe('arabic');
    expect(scriptOf('Ευχαριστούμε')).toBeUndefined();
    expect(scriptOf('Merci !')).toBeUndefined();
  });
});

describe('serializeJsonLd', () => {
  it('cannot be used to close the script tag', () => {
    const out = serializeJsonLd({ reviewBody: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out).reviewBody).toBe('</script><script>alert(1)</script>');
  });
});
