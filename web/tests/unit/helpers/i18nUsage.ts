import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Static analysis of how the code uses the message files: which keys a file asks for, and which keys
// exist but nothing seems to ask for. It reads the source as text (no TypeScript parsing), so it is
// deliberately forgiving: a key counts as used when the code could plausibly mean it.

type Messages = { [key: string]: string | Messages };

export const SRC = join(__dirname, '../../../src');

export function flatten(obj: Messages, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : flatten(value, path);
  });
}

export function loadEnglish(): Messages {
  return JSON.parse(readFileSync(join(SRC, 'messages/en.json'), 'utf8'));
}

export function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'messages' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

export type Usage = {
  /** Keys a call asked for by name that no message file has: { file, key }. */
  missing: { file: string; key: string }[];
  /** Keys that exist and that the code appears to use. */
  used: Set<string>;
};

// `useTranslations('ns')` / `getTranslations('ns')` / `getTranslations({ locale, namespace: 'ns' })`
const TRANSLATOR_CALL = /\b(?:useTranslations|getTranslations)\(\s*(?:'([^']*)'|"([^"]*)"|\{[^}]*namespace:\s*'([^']*)'[^}]*\})?\s*\)/g;
// const t = useTranslations(...)  /  const tr = await getTranslations(...)
const SINGLE_BINDING = /\bconst\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(/g;
// const [t, tHome] = await Promise.all([getTranslations(..), getTranslations(..), other()])
const ARRAY_BINDING = /\bconst\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.all\(\s*\[([\s\S]*?)\]\s*\)/g;
// useTranslations('home')('retry')
const CURRIED_CALL = /\b(?:useTranslations|getTranslations)\(\s*'([^']*)'\s*\)\(\s*'([^']+)'/g;

export function analyse(english: Messages, files = sourceFiles()): Usage {
  const keys = new Set(flatten(english));
  const used = new Set<string>();
  const missing: Usage['missing'][number][] = [];

  const hasKey = (key: string) => keys.has(key);
  const markPrefix = (prefix: string) => {
    for (const key of keys) if (key.startsWith(prefix)) used.add(key);
  };

  for (const file of files) {
    const text = readFileSync(file, 'utf8');

    // Namespaces this file translates in ('' = the whole tree) and the names bound to translators.
    const namespaces = new Set<string>(['']);
    for (const m of text.matchAll(TRANSLATOR_CALL)) {
      const ns = m[1] ?? m[2] ?? m[3];
      if (ns) namespaces.add(ns);
    }
    const names = new Set<string>(['t']);
    for (const m of text.matchAll(SINGLE_BINDING)) names.add(m[1]);
    for (const m of text.matchAll(ARRAY_BINDING)) {
      const bound = m[1].split(',').map((s) => s.trim());
      const calls = m[2].split(/,\s*(?=\w)/).map((s) => s.trim());
      bound.forEach((name, i) => {
        if (/(?:useTranslations|getTranslations)/.test(calls[i] ?? '')) names.add(name);
      });
    }

    const resolve = (key: string) => [...namespaces].map((ns) => (ns ? `${ns}.${key}` : key));

    // t('key'), t.rich('key'), t.raw('key'), t.has('key'), t(`prefix.${x}`)
    const callee = [...names].join('|');
    const call = new RegExp(`\\b(?:${callee})(?:\\.(?:rich|raw|has|markup))?\\(\\s*(['"\`])([^'"\`]*?)\\1`, 'g');
    for (const m of text.matchAll(call)) {
      const key = m[2];
      if (m[1] === '`' && text.slice(m.index, m.index + m[0].length + 200).includes('${')) {
        // handled by the template pattern below
      }
      const found = resolve(key).filter(hasKey);
      if (found.length) found.forEach((k) => used.add(k));
      else if (!key.includes('${')) {
        const isGroup = resolve(key).some((k) => [...keys].some((x) => x.startsWith(`${k}.`)));
        if (!isGroup) missing.push({ file, key });
      }
    }
    // template keys: t(`live.status.${status}`) -> every key under live.status.
    const template = new RegExp(`\\b(?:${callee})(?:\\.(?:rich|raw|has|markup))?\\(\\s*\`([^\`]*?)\\$\\{`, 'g');
    for (const m of text.matchAll(template)) {
      if (!m[1]) continue; // `${flow}Title`: no fixed start, handled by the tail pattern below
      for (const k of resolve(m[1])) markPrefix(k);
    }
    for (const m of text.matchAll(CURRIED_CALL)) {
      const k = `${m[1]}.${m[2]}`;
      if (hasKey(k)) used.add(k);
      else missing.push({ file, key: k });
    }

    // Message keys kept as data (e.g. nameKey: 'home.siteLatin', or 'siteLatin' next to useTranslations('home')).
    for (const m of text.matchAll(/(['"`])([A-Za-z][\w.]*)\1/g)) {
      for (const k of resolve(m[2])) if (hasKey(k)) used.add(k);
    }
    // t(`${flow}Title`) style keys built from a variable: any key whose last part looks like the literal tail.
    for (const m of text.matchAll(/\$\{\w+\}([A-Za-z][\w]*)`/g)) {
      for (const key of keys) if (key.endsWith(m[1]) && namespaces.has(key.split('.').slice(0, -1).join('.'))) used.add(key);
    }
  }
  return { missing, used };
}
