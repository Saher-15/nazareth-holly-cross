// The visitor's accessibility settings (the panel in the site header, components/layout/A11yPanel.tsx).
//
// They live in localStorage under one key and are applied as data attributes on <html>; the CSS that reads the
// attributes is in styles/tokens.css (high contrast, readable font, text size) and styles/globals.css (links,
// motion, spacing, focus, cursor). A tiny script in the <head> (A11Y_PREPAINT, given the request's CSP nonce by
// app/[locale]/layout.tsx) sets the attributes before the first paint, so a visitor who chose large text never
// sees the page jump. Nothing is sent anywhere and no cookie is used.

export const A11Y_STORAGE_KEY = 'nhc.a11y.v1';
/** Fired on window whenever the settings change, so motion-aware components (the hero film) can follow. */
export const A11Y_EVENT = 'nhc:a11y-change';

/** Text size steps in percent of the browser's own size (WCAG 1.4.4 asks for 200% without loss). */
export const TEXT_SIZES = [100, 125, 150, 175, 200] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export type A11ySettings = {
  text: TextSize;
  /** High-contrast colours: black, white and a brighter gold. */
  contrast: boolean;
  /** Underline every link. */
  links: boolean;
  /** Stop animations, the Ken Burns zoom, page transitions and the hero film (the system setting is honoured anyway). */
  motion: boolean;
  /** One plain sans-serif typeface for headings and text. */
  font: boolean;
  /** Line, paragraph, letter and word spacing of WCAG 1.4.12. */
  spacing: boolean;
  /** A thicker, two-colour focus ring. */
  focus: boolean;
  /** A large mouse pointer. */
  cursor: boolean;
};

export const SWITCHES = ['contrast', 'links', 'motion', 'font', 'spacing', 'focus', 'cursor'] as const;
export type SwitchName = (typeof SWITCHES)[number];

export const DEFAULT_SETTINGS: A11ySettings = {
  text: 100,
  contrast: false,
  links: false,
  motion: false,
  font: false,
  spacing: false,
  focus: false,
  cursor: false,
};

/** The data attribute each switch sets on <html>, and its value when on. */
export const SWITCH_ATTRIBUTES: Record<SwitchName, readonly [name: string, value: string]> = {
  contrast: ['data-a11y-contrast', 'high'],
  links: ['data-a11y-links', 'underline'],
  motion: ['data-a11y-motion', 'reduce'],
  font: ['data-a11y-font', 'readable'],
  spacing: ['data-a11y-spacing', 'wide'],
  focus: ['data-a11y-focus', 'strong'],
  cursor: ['data-a11y-cursor', 'large'],
};
export const TEXT_ATTRIBUTE = 'data-a11y-text';

/** Settings read back from storage: anything on the origin can write there, so only known values survive. */
export function parseSettings(raw: unknown): A11ySettings {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const record = value as Record<string, unknown>;
  const settings = { ...DEFAULT_SETTINGS };
  if (TEXT_SIZES.includes(record.text as TextSize)) settings.text = record.text as TextSize;
  for (const name of SWITCHES) settings[name] = record[name] === true;
  return settings;
}

export const isDefault = (settings: A11ySettings) =>
  settings.text === DEFAULT_SETTINGS.text && SWITCHES.every((name) => settings[name] === DEFAULT_SETTINGS[name]);

/** The attributes <html> carries for these settings (only the ones that are on). */
export function settingsToAttributes(settings: A11ySettings): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (settings.text !== 100) attributes[TEXT_ATTRIBUTE] = String(settings.text);
  for (const name of SWITCHES) {
    if (settings[name]) {
      const [attribute, on] = SWITCH_ATTRIBUTES[name];
      attributes[attribute] = on;
    }
  }
  return attributes;
}

/** Puts the settings on an element (normally <html>), removing the attributes of settings that are off. */
export function applySettings(root: HTMLElement, settings: A11ySettings): void {
  const wanted = settingsToAttributes(settings);
  for (const attribute of [TEXT_ATTRIBUTE, ...SWITCHES.map((name) => SWITCH_ATTRIBUTES[name][0])]) {
    if (attribute in wanted) root.setAttribute(attribute, wanted[attribute]);
    else root.removeAttribute(attribute);
  }
}

// When storage is blocked (some private modes) the settings still work for the open page: they are kept here.
let memory: string | null = null;

/** The stored settings as text (null when there are none): the snapshot the panel subscribes to. */
export function readStoredSettings(): string | null {
  try {
    return window.localStorage.getItem(A11Y_STORAGE_KEY);
  } catch {
    return memory;
  }
}

/** The stored settings; the defaults when storage is empty, blocked (private mode) or tampered with. */
export const loadSettings = (): A11ySettings => parseSettings(readStoredSettings());

/** Stores the settings (nothing is kept when they are the defaults). Returns false when storage is blocked. */
export function saveSettings(settings: A11ySettings): boolean {
  memory = isDefault(settings) ? null : JSON.stringify(settings);
  try {
    if (memory === null) window.localStorage.removeItem(A11Y_STORAGE_KEY);
    else window.localStorage.setItem(A11Y_STORAGE_KEY, memory);
    return true;
  } catch {
    return false;
  }
}

/** Applies, stores and announces new settings. */
export function commitSettings(settings: A11ySettings): void {
  applySettings(document.documentElement, settings);
  saveSettings(settings);
  window.dispatchEvent(new Event(A11Y_EVENT));
}

/** Calls `onChange` when the settings change here or in another tab (and applies the other tab's choice). */
export function subscribeSettings(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== A11Y_STORAGE_KEY) return;
    applySettings(document.documentElement, loadSettings());
    window.dispatchEvent(new Event(A11Y_EVENT));
  };
  window.addEventListener(A11Y_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(A11Y_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

// The pre-paint script: the same reading and validation as parseSettings + applySettings, written as plain ES5
// so it can run inline in the <head> before anything is drawn. web/tests/unit/a11y.test.ts runs it against the
// functions above, so the two cannot drift. It only sets attributes; a failure (storage blocked) changes nothing.
export const A11Y_PREPAINT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)})||'null');if(!s||typeof s!=='object')return;var d=document.documentElement;if(${JSON.stringify(
  TEXT_SIZES.filter((size) => size !== 100),
)}.indexOf(s.text)>-1)d.setAttribute(${JSON.stringify(TEXT_ATTRIBUTE)},String(s.text));var m=${JSON.stringify(
  SWITCH_ATTRIBUTES,
)};for(var k in m)if(s[k]===true)d.setAttribute(m[k][0],m[k][1])}catch(e){}})();`;
