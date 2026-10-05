import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The look of the site lives in src/styles/tokens.css. Every other stylesheet uses the tokens, so a
// colour or a typeface changes in one place (docs/ENGINEERING.md, "Design system").

const SRC = join(__dirname, '../../src');
const TOKENS = join(SRC, 'styles/tokens.css');

function stylesheets(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith('.css') && path !== TOKENS ? [path] : [];
  });
}

/** Lines of a stylesheet outside comments, with their numbers. */
function codeLines(file: string): { n: number; text: string }[] {
  const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  return source.split(/\r?\n/).map((text, i) => ({ n: i + 1, text }));
}

const offences = (pattern: RegExp) =>
  stylesheets().flatMap((file) =>
    codeLines(file)
      .filter(({ text }) => pattern.test(text))
      .map(({ n, text }) => `${relative(SRC, file)}:${n}  ${text.trim()}`),
  );

describe('stylesheets', () => {
  it('there are stylesheets to check', () => {
    expect(stylesheets().length).toBeGreaterThan(30);
  });

  it('use no raw hex colours: take one from tokens.css (or add a token there)', () => {
    expect(offences(/#[0-9a-fA-F]{3,8}\b/)).toEqual([]);
  });

  it('use no rgb()/hsl() colours: color-mix() a token with transparent instead', () => {
    expect(offences(/\b(?:rgba?|hsla?)\(/)).toEqual([]);
  });

  it('name no typeface: use var(--serif), var(--sans) or the script-specific font variables', () => {
    const allowed = /font-family:\s*(?:var\(|inherit|initial)/;
    expect(offences(/font-family:/).filter((line) => !allowed.test(line))).toEqual([]);
  });

  it('use logical properties, so Hebrew and Arabic mirror (inline-start/end, not left/right)', () => {
    const physical =
      /(?:^|[\s;{])(?:(?:margin|padding|border)-(?:left|right)(?:-[a-z]+)?|left|right)\s*:|(?:text-align|float|clear)\s*:\s*(?:left|right)/;
    expect(offences(physical)).toEqual([]);
  });
});
