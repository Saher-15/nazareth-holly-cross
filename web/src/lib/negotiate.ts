// Helpers for src/proxy.ts: choosing a language for a visitor who did not pick one in the URL.
// The matching itself is next-intl's (cookie first, then Accept-Language through @formatjs/intl-localematcher);
// these helpers only prepare the request it looks at.

type LanguageRange = { tag: string; q: number };

/** Accept-Language "fr-CH, fr;q=0.9, en;q=0.8" → [{tag:'fr-CH', q:1}, ...]; malformed entries are skipped. */
export function parseAcceptLanguage(header: string): LanguageRange[] {
  return header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const [tag, ...params] = part.split(';').map((s) => s.trim());
      if (!/^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$|^\*$/.test(tag)) return [];
      const qParam = params.find((p) => p.toLowerCase().startsWith('q='));
      const q = qParam === undefined ? 1 : Number(qParam.slice(2));
      return Number.isFinite(q) && q >= 0 && q <= 1 ? [{ tag, q }] : [];
    });
}

/**
 * Adds a supported language right behind a requested one the site does not offer but that is a much better
 * choice than English (Belarusian → Russian, Catalan → Spanish ...). A language the visitor lists themselves
 * always wins over the added one. The header is returned unchanged when nothing needs adding.
 */
export function withLanguageFallbacks(
  header: string,
  supported: readonly string[],
  fallbacks: Readonly<Record<string, string>>,
): string {
  const ranges = parseAcceptLanguage(header);
  const primary = (tag: string) => tag.toLowerCase().split('-')[0];
  const supportedPrimaries = new Set(supported.map(primary));
  const listed = new Set(ranges.map((r) => primary(r.tag)));

  const extra: string[] = [];
  for (const { tag, q } of ranges) {
    const lang = primary(tag);
    const target = fallbacks[lang];
    if (!target || supportedPrimaries.has(lang) || listed.has(target) || q === 0) continue;
    listed.add(target);
    extra.push(`${target};q=${Math.max(q - 0.001, 0.001).toFixed(3)}`);
  }
  return extra.length ? `${header}, ${extra.join(', ')}` : header;
}

// Search-engine, social-preview and speed-test robots. They get the default language for a bare URL
// whatever their headers say (a crawler has no language preference and must see one stable answer).
const CRAWLER =
  /bot\b|bot\/|crawl|spider|slurp|mediapartners|facebookexternalhit|facebot|embedly|pinterest|whatsapp|telegram|skypeuripreview|linkedin|discord|slack|lighthouse|pagespeed|gtmetrix|inspectiontool|ia_archiver|bingpreview|yandex|baidu|duckduck|semrush|ahrefs|mj12/i;

export function isCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && CRAWLER.test(userAgent);
}
