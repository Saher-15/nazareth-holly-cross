import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// docs/DESIGN-GUIDE.md is the specification every UI change follows. This test keeps it true: it fails when the
// guide documents a token, a class, a component, a file or a message key that no longer exists, when a contrast
// number no longer matches tokens.css, and when a token or a ui-* class exists in the code but is not in the guide.
// Conventions that make the guide checkable: files are written from the repository root, a class with its dot
// (`.ui-btn`), a custom property with its dashes (`--gold`), a component in angle brackets (`<Reveal>`), a
// message key in dotted form (`ux.share.copied`).

const ROOT = join(__dirname, '../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const GUIDE_PATH = 'docs/DESIGN-GUIDE.md';
const guide = read(GUIDE_PATH);

/** The guide without fenced code blocks, and the code blocks on their own. */
const fences = [...guide.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((m) => m[1]);
const prose = guide.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
const spansOf = (text: string) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
const spans = spansOf(prose);

function walk(dir: string, accept: (file: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.next') return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, accept);
    return accept(path) ? [path] : [];
  });
}

const cssFiles = [...walk(join(ROOT, 'web/src'), (f) => f.endsWith('.css')), ...walk(join(ROOT, 'admin/src'), (f) => f.endsWith('.css'))];
const css = cssFiles.map((f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
const cssAll = css.join('\n');

const definedProps = new Set([...cssAll.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
const usedProps = new Set([...cssAll.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((m) => m[1]));
const classNames = new Set([...cssAll.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]));

const sourceText = [
  ...walk(join(ROOT, 'web/src'), (f) => /\.(ts|tsx)$/.test(f)),
  ...walk(join(ROOT, 'admin/src'), (f) => /\.(ts|tsx)$/.test(f)),
]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

// A component whose file is named after it (a default export built from dynamic() has no `function Name`).
const componentFiles = new Set(
  [...walk(join(ROOT, 'web/src'), (f) => f.endsWith('.tsx')), ...walk(join(ROOT, 'admin/src'), (f) => f.endsWith('.tsx'))].map(
    (f) => f.replace(/^.*[\\/]/, '').replace(/\.tsx$/, ''),
  ),
);

const tokensOf = (file: string) => {
  const map = new Map<string, string>();
  for (const m of read(file).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!map.has(m[1])) map.set(m[1], m[2].trim());
  }
  return map;
};
const webTokens = tokensOf('web/src/styles/tokens.css');
const adminTokens = tokensOf('admin/src/styles/tokens.css');

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '');
const mentions = (name: string) => new RegExp(`(^|[^a-z0-9-])${name}(?![a-z0-9-])`).test(guide);

// ---------------------------------------------------------------------------------------------- tokens and classes

describe('the guide names only tokens, classes and components that exist', () => {
  it('has something to check', () => {
    expect(spans.length).toBeGreaterThan(300);
    expect(webTokens.size).toBeGreaterThan(60);
    expect(classNames.size).toBeGreaterThan(200);
  });

  it('every custom property in backticks exists in a stylesheet', () => {
    const missing = spans.filter((s) => /^--[a-z0-9-]+$/.test(s) && !definedProps.has(s) && !usedProps.has(s));
    expect(missing).toEqual([]);
  });

  it('every var(--x) in a code block is defined', () => {
    const used = fences.flatMap((block) => [...block.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]));
    expect(used.filter((name) => !definedProps.has(name))).toEqual([]);
  });

  it('every .class in backticks exists in a stylesheet', () => {
    const missing = spans.filter((s) => /^\.[a-z][\w-]*$/.test(s) && !classNames.has(s.slice(1)));
    expect(missing).toEqual([]);
  });

  it('every ui-* class mentioned anywhere in the guide exists', () => {
    const mentioned = new Set([...guide.matchAll(/(?<![\w-])ui-[a-z][a-z0-9_-]*/g)].map((m) => m[0]));
    expect([...mentioned].filter((name) => !classNames.has(name))).toEqual([]);
  });

  it('every <Component> in backticks exists in the code', () => {
    const names = spans.flatMap((s) => {
      const m = s.match(/^<([A-Z][A-Za-z0-9]*)\s*\/?>$/);
      return m ? [m[1]] : [];
    });
    expect(names.length).toBeGreaterThan(40);
    const missing = names.filter(
      (name) => !new RegExp(`\\b(function|const|class)\\s+${name}\\b`).test(sourceText) && !componentFiles.has(name),
    );
    expect([...new Set(missing)]).toEqual([]);
  });

  it('every message key in backticks exists (public site or admin)', () => {
    const en = JSON.parse(read('web/src/messages/en.json')) as Record<string, unknown>;
    const adminEn = read('admin/src/i18n/messages/en.ts');
    const exists = (key: string) => {
      let node: unknown = en;
      for (const part of key.split('.')) {
        if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) node = (node as Record<string, unknown>)[part];
        else return adminEn.includes(`'${key}'`);
      }
      return true;
    };
    const extensions = /\.(ts|tsx|css|json|md|mjs|js|yml|toml|jpg|png|svg|webp)$/;
    const keys = spans.filter(
      (s) => /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9-]+)+$/.test(s) && s.split('.')[0] in en && !extensions.test(s),
    );
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.filter((key) => !exists(key))).toEqual([]);
  });
});

describe('the guide documents everything the design system defines', () => {
  it('every token of web/src/styles/tokens.css is in the guide', () => {
    const missing = [...webTokens.keys()].filter((name) => !mentions(name));
    expect(missing, 'add these tokens to docs/DESIGN-GUIDE.md section 3').toEqual([]);
  });

  it('every ui-* class of web/src/styles/ui.css is in the guide', () => {
    const uiClasses = new Set([...css[cssFiles.findIndex((f) => f.endsWith('styles\\ui.css') || f.endsWith('styles/ui.css'))].matchAll(/\.(ui-[a-z][\w-]*)/g)].map((m) => m[1]));
    expect(uiClasses.size).toBeGreaterThan(40);
    const missing = [...uiClasses].filter((name) => !mentions(name));
    expect(missing, 'add these classes to docs/DESIGN-GUIDE.md section 5').toEqual([]);
  });

  it('the values quoted for colour tokens and type sizes match tokens.css', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const line of prose.split('\n')) {
      const m = line.match(/^\|\s*`(--[\w-]+)`\s*\|\s*`([^`]+)`\s*\|/);
      if (!m) continue;
      const actual = webTokens.get(m[1]) ?? adminTokens.get(m[1]);
      if (actual === undefined) continue;
      if (!/^(#|rgba\(|clamp\(|[\d.]+rem)/.test(m[2])) continue;
      checked += 1;
      if (normalize(actual) !== normalize(m[2])) wrong.push(`${m[1]}: guide says ${m[2]}, tokens say ${actual}`);
    }
    expect(checked).toBeGreaterThan(25);
    expect(wrong).toEqual([]);
  });

  it('the colour tokens the admin copies are equal to the site (they must not drift)', () => {
    const drift: string[] = [];
    for (const [name, value] of adminTokens) {
      const site = webTokens.get(name);
      if (site !== undefined && /^(#|rgba\()/.test(value) && normalize(site) !== normalize(value)) drift.push(`${name}: site ${site}, admin ${value}`);
    }
    expect(drift).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------------ contrast

function parseColor(value: string): { rgb: [number, number, number]; a: number } {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const rgba = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgba) return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], a: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  throw new Error(`cannot read the colour "${value}"`);
}
const over = (fg: number[], a: number, bg: number[]) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = (rgb: number[]) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
const ratio = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('the contrast table of section 3.2', () => {
  const token = (name: string) => {
    const value = webTokens.get(name) ?? adminTokens.get(name);
    if (!value) throw new Error(`unknown token ${name}`);
    return parseColor(value);
  };
  const night = token('--night').rgb;

  const rows = prose.split('\n').flatMap((line) => {
    const m = line.match(/^\|\s*`(--[\w-]+)`\s+on\s+`(--[\w-]+)`[^|]*\|\s*([\d.]+)\s*\|\s*(pass|FAIL)\s*\|\s*(pass|FAIL)\s*\|\s*(pass|FAIL)\s*\|/);
    return m ? [{ fg: m[1], bg: m[2], stated: Number(m[3]), text: m[4], large: m[5], aaa: m[6] }] : [];
  });

  it('lists the pairs the design uses', () => {
    expect(rows.length).toBeGreaterThanOrEqual(35);
  });

  it('every ratio and every pass mark is what the tokens give', () => {
    const wrong: string[] = [];
    for (const row of rows) {
      const bgColor = token(row.bg);
      const bg = over(bgColor.rgb, bgColor.a, night);
      const fgColor = token(row.fg);
      const fg = over(fgColor.rgb, fgColor.a, bg);
      const actual = ratio(fg, bg);
      const mark = (ok: boolean) => (ok ? 'pass' : 'FAIL');
      if (Math.abs(actual - row.stated) > 0.01) wrong.push(`${row.fg} on ${row.bg}: guide ${row.stated}, computed ${actual.toFixed(2)}`);
      if (row.text !== mark(actual >= 4.5)) wrong.push(`${row.fg} on ${row.bg}: text mark ${row.text} but ratio is ${actual.toFixed(2)}`);
      if (row.large !== mark(actual >= 3)) wrong.push(`${row.fg} on ${row.bg}: large mark ${row.large} but ratio is ${actual.toFixed(2)}`);
      if (row.aaa !== mark(actual >= 7)) wrong.push(`${row.fg} on ${row.bg}: AAA mark ${row.aaa} but ratio is ${actual.toFixed(2)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('every text colour pair that is in use passes AA for normal text, except the documented ones', () => {
    // The guide documents these failures on purpose: the reserved --live badge colour with white text, and the
    // decorative hairline (not a control border). Anything else failing is a regression of the design.
    const allowed = new Set(['--white on --live', '--glass-line on --night']);
    const failing = rows.filter((r) => r.text === 'FAIL' && !allowed.has(`${r.fg} on ${r.bg}`));
    expect(failing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------- files and links

const FILE_EXT = /\.(ts|tsx|css|json|md|mjs|cjs|js|yml|yaml|toml|jpg|jpeg|png|svg|webp|avif)$/;

/** A backticked thing that is a repository path, checked from the repository root. */
function repoPaths(spanList: string[]): string[] {
  return spanList.filter(
    (s) =>
      !s.includes('...') &&
      (/^(web|admin|server|docs|client|\.github)\/[^\s]*$/.test(s) || /^(CLAUDE\.md|SECURITY\.md|netlify\.toml|render\.yaml)$/.test(s)),
  );
}

function pathExists(path: string): boolean {
  const cut = path.search(/[*<{]/);
  const clean = cut === -1 ? path : path.slice(0, cut);
  if (cut !== -1) return existsSync(join(ROOT, clean.endsWith('/') ? clean : dirname(clean)));
  return existsSync(join(ROOT, clean));
}

describe('every file the guide mentions exists', () => {
  it('has paths to check', () => {
    expect(repoPaths(spans).length).toBeGreaterThan(80);
  });

  it('every repository path in backticks exists', () => {
    const missing = repoPaths(spans).filter((p) => !pathExists(p));
    expect([...new Set(missing)]).toEqual([]);
  });

  it('every backticked path is written from the repository root (no ambiguous short paths)', () => {
    const shorts = spans.filter((s) => /^(src|components|tests|scripts)\/[^\s]*$/.test(s) && FILE_EXT.test(s));
    expect(shorts, 'write the full path, e.g. web/src/...').toEqual([]);
  });

  it('every image and link target exists', () => {
    const targets = [...guide.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((t) => !/^(https?:|mailto:|#)/.test(t));
    expect(targets.length).toBeGreaterThan(25);
    const missing = targets.filter((t) => !existsSync(join(ROOT, dirname(GUIDE_PATH), t.split('#')[0])));
    expect(missing).toEqual([]);
  });

  it('the pictures stay small (docs/design under 6 MB, only JPEG, PNG and WebP)', () => {
    const dir = join(ROOT, 'docs/design');
    const files = readdirSync(dir);
    const total = files.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
    expect(total).toBeLessThan(6 * 1024 * 1024);
    expect(files.filter((f) => !/\.(jpe?g|png|webp)$/i.test(f))).toEqual([]);
  });

  it('no two files in docs/ differ only by case (Windows is case-insensitive)', () => {
    const all = walk(join(ROOT, 'docs'), () => true).map((f) => relative(ROOT, f).toLowerCase());
    expect(all.length - new Set(all).size).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------ structure and wiring

describe('the structure of the guide', () => {
  const headings = [...guide.matchAll(/^(#{2,4})\s+(.+)$/gm)].map((m) => m[2].trim());
  const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-');

  it('has the fourteen numbered sections', () => {
    for (let n = 1; n <= 14; n += 1) {
      expect(headings.some((h) => h.startsWith(`${n}. `)), `section ${n}`).toBe(true);
    }
  });

  it('has a table of contents whose links all lead to a heading', () => {
    const anchors = new Set(headings.map(slug));
    const links = [...guide.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThanOrEqual(14);
    expect(links.filter((a) => !anchors.has(a))).toEqual([]);
  });
});

describe('the working agreement and CLAUDE.md', () => {
  const agreement = read('docs/WORKING-AGREEMENT.md');
  const claude = read('CLAUDE.md');

  it('CLAUDE.md makes both documents mandatory reading', () => {
    expect(claude).toContain('docs/DESIGN-GUIDE.md');
    expect(claude).toContain('docs/WORKING-AGREEMENT.md');
  });

  it('the working agreement points to the guide and the rulebooks', () => {
    for (const doc of ['docs/DESIGN-GUIDE.md', 'docs/ENGINEERING.md', 'docs/SECURITY.md', 'docs/ADMIN.md', 'docs/ADMIN-RUNBOOK.md', 'docs/DESIGN.md', 'docs/PERFORMANCE.md', 'docs/QA.md']) {
      expect(agreement, doc).toContain(doc);
    }
  });

  it('every path the working agreement and CLAUDE.md mention exists', () => {
    const missing = repoPaths([...spansOf(agreement), ...spansOf(claude)]).filter((p) => !pathExists(p));
    expect([...new Set(missing)]).toEqual([]);
  });
});
