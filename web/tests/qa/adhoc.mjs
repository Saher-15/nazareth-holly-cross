const BASE = 'http://localhost:3603';
for (const p of ['/en/no-such-page', '/en/sites/zzz', '/xx-yy/zzz']) {
  const r = await fetch(BASE + p, { redirect: 'manual' });
  const h = await r.text();
  const i = h.indexOf('<body');
  console.log(p, r.status, h.length, 'lang attr:', /<html[^>]*lang=/.test(h), 'has h1:', /<h1/.test(h), 'text:', h.includes('could not be found'), 'next_error:', h.includes('__next_error__'));
  console.log(h.slice(i, i + 400).replace(/\s+/g, ' '));
}
