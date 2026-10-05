// The API's input sanitiser (express-xss-sanitizer) HTML-escapes what visitors type before it is stored,
// so "Peace & love" is saved as "Peace &amp; love". React escapes text itself when it renders, so showing
// the stored value as it is would print "&amp;". This turns the five basic entities back into the
// characters they stand for. It is only ever used on values that are then rendered as TEXT (never as
// HTML), and it decodes exactly once: "&amp;lt;" becomes "&lt;", not "<".
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

export const decodeEntities = (value: string): string => value.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m]);
