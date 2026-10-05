// Matching and ranking of the site search, free of React so it can be unit tested. The index itself
// (src/data/pilgrim/searchIndex.ts) is built per language from the messages.

export type SearchType = 'page' | 'site' | 'faq' | 'gospel';

export type SearchEntry = {
  id: string;
  type: SearchType;
  title: string;
  /** Longer text that is searched too (description, answer, quote) and shown as a snippet. */
  text: string;
  /** Path without the language, e.g. "/faq#shop-shipping". */
  href: string;
};

/** Lower case, accents and Hebrew/Arabic marks removed, so "Nazaré", "nazare" and "NAZARE" match. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-֑ͯ-ׇً-ٰٟ]/g, '')
    .replace(/[ـ'’`"“”«»]/g, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** The words of a query (at most 6). */
export const tokens = (query: string) => normalize(query).split(' ').filter(Boolean).slice(0, 6);

// Scores of the places a word can be found in; the best place of each word counts, all words must match.
const SCORE = { titleStart: 100, titleWord: 80, title: 60, text: 20 } as const;

function wordScore(word: string, title: string, text: string): number {
  if (title.startsWith(word)) return SCORE.titleStart;
  if (title.split(' ').some((w) => w.startsWith(word))) return SCORE.titleWord;
  if (title.includes(word)) return SCORE.title;
  if (text.includes(word)) return SCORE.text;
  return 0;
}

/** Entries that match every word of the query, best first (ties keep the index order). */
export function searchEntries(entries: readonly SearchEntry[], query: string, limit = 12): SearchEntry[] {
  const words = tokens(query);
  if (!words.length) return [];
  return entries
    .map((entry, order) => {
      const title = normalize(entry.title);
      const text = normalize(entry.text);
      let total = 0;
      for (const word of words) {
        const score = wordScore(word, title, text);
        if (!score) return { entry, order, score: 0 };
        total += score;
      }
      return { entry, order, score: total };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((m) => m.entry);
}

/** A short piece of the text around the first matching word. */
export function snippet(text: string, query: string, length = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= length) return flat;
  const first = tokens(query)[0];
  const at = first ? normalize(flat).indexOf(first) : -1;
  // normalize() can change string length (removed marks), so the position is only a hint.
  const start = at > 40 ? Math.min(at - 40, flat.length - length) : 0;
  const body = flat.slice(Math.max(0, start), Math.max(0, start) + length).trim();
  return `${start > 0 ? '…' : ''}${body}${start + length < flat.length ? '…' : ''}`;
}
