import { describe, it, expect } from 'vitest';

// services/mailText.js: what of a visitor's typed text may appear in a mail sent from the church's Gmail account
// (security review 06, finding 5).

const { greeting, greetingName, plainMailText, GREETING_MAX } = await import('../services/mailText.js');

describe('greetingName: a name, or nothing', () => {
  it.each([
    ['Maria', 'Maria'],
    ['  Maria  ', 'Maria'],
    ['Mary Ann', 'Mary Ann'],
    ["O'Brien", "O'Brien"],
    ['Jean-Luc', 'Jean-Luc'],
    ['José', 'José'],
    ['Zoë', 'Zoë'],
    ['محمد', 'محمد'],
    ['מרים', 'מרים'],
    ['Παναγιώτης', 'Παναγιώτης'],
    ['Мария', 'Мария'],
    ['李', '李'],
  ])('keeps %j', (typed, expected) => {
    expect(greetingName(typed)).toBe(expected);
  });

  it.each([
    ['a phishing sentence', 'Your PayPal refund is ready, claim it at https://evil.example/claim'],
    ['a link', 'https://evil.example'],
    ['a bare domain', 'evil.example'],
    ['a www address', 'www.evil'],
    ['an e-mail address', 'a@evil.example'],
    ['a tag', '<b>Maria</b>'],
    ['an escaped tag', '&lt;b&gt;Maria'],
    ['an entity', 'Maria&amp;Co'],
    ['a line break', 'Maria\nBcc: x@y.zz'],
    ['a carriage return', 'Maria\rX'],
    ['a tab', 'Maria\tX'],
    ['a right-to-left override', 'Maria‮exe'],
    ['a zero-width space', 'Ma​ria'],
    ['a line separator', 'Maria X'],
    ['digits', 'Maria 2'],
    ['four words', 'Anna Maria Lucia Rosa'],
    ['punctuation', 'Maria!'],
    ['a colon', 'Note:'],
    ['an emoji', 'Maria 🙏'],
    ['too long', 'A'.repeat(GREETING_MAX + 1)],
    ['only spaces', '   '],
    ['empty', ''],
    ['a number', 5],
    ['an object', { $ne: null }],
    ['an array', ['Maria']],
    ['nothing', undefined],
  ])('refuses %s', (_label, typed) => {
    expect(greetingName(typed)).toBeNull();
  });

  it('greeting falls back to "friend"', () => {
    expect(greeting('Maria')).toBe('Dear Maria,');
    expect(greeting('Claim your refund at https://evil.example')).toBe('Dear friend,');
    expect(greeting(undefined)).toBe('Dear friend,');
  });
});

describe('plainMailText: no markup, links, control characters; one line; bounded', () => {
  it('removes tags, entities, links and invisible characters and joins lines', () => {
    const out = plainMailText('Hello <script>x</script> see https://evil.example/a?b=c and www.evil.example\r\nBcc: a@b.co &amp; more‮');
    expect(out).not.toMatch(/[<>]|https?:|www\.|evil|&amp;|\r|\n|‮/);
    expect(out.startsWith('Hello')).toBe(true);
  });

  it('caps the length (in characters, not UTF-16 units)', () => {
    expect([...plainMailText('א'.repeat(500), 40)]).toHaveLength(40);
    expect(plainMailText('x'.repeat(10), 0)).toBe('');
  });

  it('gives an empty text for anything that is not text', () => {
    for (const value of [undefined, null, 5, {}, ['a']]) expect(plainMailText(value)).toBe('');
  });
});
