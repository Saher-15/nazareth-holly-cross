import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import A11yPanel from '@/components/layout/A11yPanel';
import MotionToggle, { MOTION_PAUSE_EVENT } from '@/components/ui/MotionToggle';
import {
  A11Y_EVENT,
  A11Y_PREPAINT,
  A11Y_STORAGE_KEY,
  applySettings,
  commitSettings,
  DEFAULT_SETTINGS,
  isDefault,
  loadSettings,
  parseSettings,
  saveSettings,
  settingsToAttributes,
  SWITCHES,
  TEXT_SIZES,
  type A11ySettings,
} from '@/lib/a11y';
import { prefersReducedMotion } from '@/lib/motion';
import messages from '@/messages/en.json';

// The accessibility settings (docs/ACCESSIBILITY.md): reading them back safely, the attributes they put on <html>,
// the pre-paint script that must do exactly the same, the panel's keyboard behaviour, and the colours of the
// high-contrast mode.

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, onClick, className }: { children: ReactNode; href: string; onClick?: () => void; className?: string }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

const withIntl = (ui: ReactNode) => (
  <NextIntlClientProvider locale="en" messages={messages}>
    {ui}
  </NextIntlClientProvider>
);

const root = () => document.documentElement;
const a11yAttributes = () => Object.fromEntries([...root().attributes].filter((a) => a.name.startsWith('data-a11y-')).map((a) => [a.name, a.value]));
const resetDom = () => {
  for (const name of Object.keys(a11yAttributes())) root().removeAttribute(name);
};

beforeEach(() => {
  localStorage.clear();
  resetDom();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ALL_ON: A11ySettings = { text: 200, contrast: true, links: true, motion: true, font: true, spacing: true, focus: true, cursor: true };

describe('parseSettings: only known values survive (anything on the origin can write to storage)', () => {
  it('reads stored JSON and objects', () => {
    expect(parseSettings(JSON.stringify(ALL_ON))).toEqual(ALL_ON);
    expect(parseSettings({ text: 150, links: true })).toEqual({ ...DEFAULT_SETTINGS, text: 150, links: true });
  });

  it('falls back to the defaults for empty, broken or foreign data', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', '42', '"x"', 'null', JSON.stringify([1, 2])]) {
      expect(parseSettings(raw), String(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('ignores unknown sizes, truthy non-booleans and extra keys', () => {
    const parsed = parseSettings({ text: 300, contrast: 'yes', links: 1, motion: true, evil: '<script>' });
    expect(parsed).toEqual({ ...DEFAULT_SETTINGS, motion: true });
    expect(parsed).not.toHaveProperty('evil');
    expect(parseSettings({ text: '150' }).text).toBe(100);
  });

  it('offers at least three text sizes, up to 200%', () => {
    expect(TEXT_SIZES.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...TEXT_SIZES)).toBe(200);
    expect(TEXT_SIZES[0]).toBe(100);
  });
});

describe('the attributes on <html>', () => {
  it('are absent for the defaults', () => {
    expect(settingsToAttributes(DEFAULT_SETTINGS)).toEqual({});
    expect(isDefault(DEFAULT_SETTINGS)).toBe(true);
  });

  it('name every setting that is on', () => {
    expect(settingsToAttributes(ALL_ON)).toEqual({
      'data-a11y-text': '200',
      'data-a11y-contrast': 'high',
      'data-a11y-links': 'underline',
      'data-a11y-motion': 'reduce',
      'data-a11y-font': 'readable',
      'data-a11y-spacing': 'wide',
      'data-a11y-focus': 'strong',
      'data-a11y-cursor': 'large',
    });
  });

  it('are added and removed by applySettings', () => {
    applySettings(root(), ALL_ON);
    expect(Object.keys(a11yAttributes())).toHaveLength(8);
    applySettings(root(), { ...DEFAULT_SETTINGS, links: true });
    expect(a11yAttributes()).toEqual({ 'data-a11y-links': 'underline' });
    applySettings(root(), DEFAULT_SETTINGS);
    expect(a11yAttributes()).toEqual({});
  });

  it('every attribute value the code sets has CSS that reads it', () => {
    const css = ['src/styles/globals.css', 'src/styles/tokens.css', 'src/components/layout/SiteHeader.module.css']
      .map((file) => readFileSync(join(__dirname, '../..', file), 'utf8'))
      .join('\n');
    for (const [name, value] of Object.entries(settingsToAttributes(ALL_ON))) {
      if (name === 'data-a11y-text') continue;
      expect(css, `${name}='${value}'`).toContain(`[${name}='${value}']`);
    }
    for (const size of TEXT_SIZES.filter((s) => s !== 100)) expect(css).toContain(`[data-a11y-text='${size}']`);
  });
});

describe('the pre-paint script (inline in <head>, before the first paint)', () => {
  const runPrepaint = () => new Function(A11Y_PREPAINT)();

  const cases: unknown[] = [
    ALL_ON,
    DEFAULT_SETTINGS,
    { ...DEFAULT_SETTINGS, text: 125, motion: true },
    { text: 999, contrast: 'true', links: true },
    { text: '200', focus: true },
    [],
    'garbage',
  ];

  it.each(cases.map((c) => [JSON.stringify(c), c]))('sets the same attributes as applySettings for %s', (_label, value) => {
    localStorage.setItem(A11Y_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value));
    runPrepaint();
    const fromScript = a11yAttributes();
    resetDom();
    applySettings(root(), parseSettings(localStorage.getItem(A11Y_STORAGE_KEY)));
    expect(fromScript).toEqual(a11yAttributes());
  });

  it('does nothing (and does not throw) with empty, broken or blocked storage', () => {
    expect(runPrepaint).not.toThrow();
    localStorage.setItem(A11Y_STORAGE_KEY, '{broken');
    expect(runPrepaint).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(runPrepaint).not.toThrow();
    expect(a11yAttributes()).toEqual({});
  });

  it('is small, plain and free of anything that could close the script element', () => {
    expect(A11Y_PREPAINT.length).toBeLessThan(800);
    expect(A11Y_PREPAINT).not.toMatch(/<\/?script|<!--|=>|\bconst\b|\blet\b|`/);
  });
});

describe('storing the settings', () => {
  it('round-trips through localStorage and keeps nothing for the defaults', () => {
    expect(saveSettings(ALL_ON)).toBe(true);
    expect(loadSettings()).toEqual(ALL_ON);
    saveSettings(DEFAULT_SETTINGS);
    expect(localStorage.getItem(A11Y_STORAGE_KEY)).toBeNull();
  });

  it('still works for the open page when storage is blocked (private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(saveSettings({ ...DEFAULT_SETTINGS, links: true })).toBe(false);
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, links: true });
  });

  it('commitSettings applies, stores and announces', () => {
    const heard = vi.fn();
    window.addEventListener(A11Y_EVENT, heard);
    commitSettings({ ...DEFAULT_SETTINGS, motion: true });
    window.removeEventListener(A11Y_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(root().getAttribute('data-a11y-motion')).toBe('reduce');
    expect(JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY) ?? '{}').motion).toBe(true);
    // "Stop animations" counts as asking for less motion everywhere JavaScript checks it.
    expect(prefersReducedMotion()).toBe(true);
    commitSettings(DEFAULT_SETTINGS);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('<A11yPanel>', () => {
  const open = () => {
    render(withIntl(<A11yPanel />));
    const trigger = screen.getByRole('button', { name: messages.ux.a11y.open });
    fireEvent.click(trigger);
    return trigger;
  };

  it('is a button that opens a labelled dialog and moves the focus into it', () => {
    const trigger = open();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    const dialog = screen.getByRole('dialog', { name: messages.ux.a11y.title });
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '100%' }));
  });

  it('offers the text sizes as radio buttons in a named group and every mode as a switch', () => {
    open();
    expect(screen.getByRole('group', { name: messages.ux.a11y.textSize })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(TEXT_SIZES.map(String));
    const names = SWITCHES.map((name) => messages.ux.a11y[name]);
    expect(screen.getAllByRole('switch').map((s) => s.closest('label')?.textContent)).toEqual(names);
    expect(screen.getByRole('link', { name: messages.ux.a11y.statement })).toHaveAttribute('href', '/accessibility');
  });

  it('applies a choice at once, keeps it, and resets everything', () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: '150%' }));
    fireEvent.click(screen.getByRole('switch', { name: messages.ux.a11y.contrast }));
    expect(a11yAttributes()).toEqual({ 'data-a11y-text': '150', 'data-a11y-contrast': 'high' });
    expect(screen.getByRole('switch', { name: messages.ux.a11y.contrast })).toBeChecked();
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, text: 150, contrast: true });

    fireEvent.click(screen.getByRole('button', { name: messages.ux.a11y.reset }));
    expect(a11yAttributes()).toEqual({});
    expect(localStorage.getItem(A11Y_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(messages.ux.a11y.resetDone);
    // The reset button keeps the focus (it is not disabled under the visitor's finger).
    expect(screen.getByRole('button', { name: messages.ux.a11y.reset })).toBeEnabled();
  });

  it('closes with Escape and gives the focus back to its button', () => {
    const trigger = open();
    fireEvent.keyDown(screen.getByRole('switch', { name: messages.ux.a11y.links }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes with its close button, and when the focus moves elsewhere', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    const trigger = open();
    fireEvent.click(screen.getByRole('button', { name: messages.ux.a11y.close }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => outside.focus());
    expect(screen.queryByRole('dialog')).toBeNull();
    outside.remove();
  });

  it('shows the stored settings and marks the button when something is on', () => {
    saveSettings({ ...DEFAULT_SETTINGS, spacing: true, text: 125 });
    open();
    expect(screen.getByRole('switch', { name: messages.ux.a11y.spacing })).toBeChecked();
    expect(screen.getByRole('radio', { name: '125%' })).toBeChecked();
    expect(screen.getByRole('button', { name: messages.ux.a11y.open })).toHaveAttribute('data-a11y-active', 'true');
  });
});

describe('<MotionToggle> (WCAG 2.2.2: pause what moves by itself)', () => {
  it('pauses and resumes its scope and tells the film', () => {
    const heard: boolean[] = [];
    render(
      withIntl(
        <section data-motion-scope="" data-testid="scope">
          <MotionToggle />
        </section>,
      ),
    );
    const scope = screen.getByTestId('scope');
    scope.addEventListener(MOTION_PAUSE_EVENT, (e) => heard.push((e as CustomEvent<{ paused: boolean }>).detail.paused));
    fireEvent.click(screen.getByRole('button', { name: messages.ux.motion.pause }));
    expect(scope).toHaveAttribute('data-motion-paused', 'true');
    fireEvent.click(screen.getByRole('button', { name: messages.ux.motion.play }));
    expect(scope).not.toHaveAttribute('data-motion-paused');
    expect(heard).toEqual([true, false]);
  });

  it('is not shown when the visitor already stopped animations', () => {
    root().setAttribute('data-a11y-motion', 'reduce');
    render(withIntl(<MotionToggle />));
    expect(screen.queryByRole('button')).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------- high-contrast colours

const tokensCss = readFileSync(join(__dirname, '../../src/styles/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const block = (selector: string) => {
  const start = tokensCss.indexOf(`${selector} {`);
  return tokensCss.slice(start, tokensCss.indexOf('}', start));
};
const tokenMap = (css: string) => new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const base = tokenMap(block(':root'));
const high = new Map([...base, ...tokenMap(block(":root[data-a11y-contrast='high']"))]);

function rgba(value: string): { rgb: number[]; a: number } {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const m = value.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/);
  if (!m) throw new Error(`cannot read ${value}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: Number(m[4]) };
}
const over = (fg: { rgb: number[]; a: number }, bg: number[]) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
const lum = (rgb: number[]) => {
  const c = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('high-contrast mode colours (tokens.css)', () => {
  const night = rgba(high.get('--night')!).rgb;
  const surface = (name: string) => over(rgba(high.get(name)!), night);
  const pair = (fg: string, bg: string) => contrast(over(rgba(high.get(fg)!), surface(bg)), surface(bg));

  it('overrides the colours that carry text and edges', () => {
    for (const name of ['--night', '--cream', '--muted', '--gold', '--on-gold', '--glass', '--glass-line', '--field-line']) {
      expect(high.get(name), name).not.toBe(base.get(name));
    }
  });

  it('every text pair in use reaches 7:1 (AAA)', () => {
    const texts: [string, string][] = [
      ['--cream', '--night'], ['--cream', '--night-2'], ['--cream', '--night-3'], ['--cream', '--glass'],
      ['--white', '--night'], ['--muted', '--night'], ['--muted', '--night-3'], ['--muted', '--glass'], ['--muted', '--glass-strong'],
      ['--gold', '--night'], ['--gold', '--night-3'], ['--gold', '--glass'], ['--gold', '--gold-soft'],
      ['--on-gold', '--gold'], ['--on-gold', '--gold-deep'], ['--on-gold', '--gold-light'],
      ['--danger', '--night'], ['--danger', '--night-3'], ['--success', '--night'],
    ];
    const weak = texts.map(([fg, bg]) => [`${fg} on ${bg}`, pair(fg, bg)] as const).filter(([, r]) => r < 7);
    expect(weak).toEqual([]);
  });

  it('borders of cards and fields reach 3:1 (WCAG 1.4.11), the focus ring too', () => {
    for (const edge of ['--glass-line', '--field-line', '--gold']) expect(pair(edge, '--night'), edge).toBeGreaterThanOrEqual(3);
  });

  it('text over a photograph sits on a darker scrim (at least 78% black)', () => {
    const scrim = high.get('--grad-scrim')!;
    const alphas = [...scrim.matchAll(/rgba\(0, 0, 0, ([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(Math.min(...alphas)).toBeGreaterThanOrEqual(0.78);
    // White text over the brightest possible photo pixel under that scrim:
    const worst = over({ rgb: [0, 0, 0], a: Math.min(...alphas) }, [255, 255, 255]);
    expect(contrast([255, 255, 255], worst)).toBeGreaterThanOrEqual(4.5);
  });
});
