// WCAG contrast of the design-token colour pairs:  node tests/qa/contrast.mjs
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const over = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
const T = { night: '#0a0e1a', night2: '#111830', night3: '#18203d', gold: '#f0c04a', goldDeep: '#c9962a', cream: '#f7efdc', muted: '#b9bfd3', danger: '#ff8a80', success: '#8be0a4', live: '#ff4d4f', white: '#ffffff' };
const c = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, hex(v)]));
const glass = over(c.white, 0.07, c.night);
const glassStrong = over(c.white, 0.12, c.night3);
const goldSoft = over(c.gold, 0.14, c.night);
const pairs = [
  ['cream on night', c.cream, c.night, 4.5],
  ['cream on night-3', c.cream, c.night3, 4.5],
  ['gold on night', c.gold, c.night, 4.5],
  ['gold on night-3', c.gold, c.night3, 4.5],
  ['gold on glass (7%)', c.gold, glass, 4.5],
  ['gold on gold-soft', c.gold, goldSoft, 4.5],
  ['gold-deep on night', c.goldDeep, c.night, 4.5],
  ['night on gold (buttons)', c.night, c.gold, 4.5],
  ['night on gold-deep', c.night, c.goldDeep, 4.5],
  ['muted on night', c.muted, c.night, 4.5],
  ['muted on night-3', c.muted, c.night3, 4.5],
  ['muted on glass (7%)', c.muted, glass, 4.5],
  ['muted on glass-strong (12%) over night-3', c.muted, glassStrong, 4.5],
  ['danger on night', c.danger, c.night, 4.5],
  ['danger on night-3', c.danger, c.night3, 4.5],
  ['success on night', c.success, c.night, 4.5],
  ['night on live badge', c.night, c.live, 4.5],
  ['gold focus ring vs night (non-text 3:1)', c.gold, c.night, 3],
  ['gold focus ring vs night-3 (non-text 3:1)', c.gold, c.night3, 3],
  ['--glass-line vs night (decorative only, never a field border: informational)', over(c.white, 0.16, c.night), c.night, 1.5],
  ['--field-line vs night (form field border, non-text 3:1)', over(c.white, 0.45, c.night), c.night, 3],
  ['--field-line vs night-3 (form field on raised card)', over(c.white, 0.45, c.night3), c.night3, 3],
];
for (const [name, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  console.log(`${r >= min ? 'PASS' : 'FAIL'} ${r.toFixed(2).padStart(5)}:1 (need ${min})  ${name}`);
}
