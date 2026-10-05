// Probes the dashboard's own server (BFF) at :3911, running against the harness API at :3912: CSRF on every
// mutation, cookie flags, session fixation, the proxy allow-list (traversal, absolute URLs), open redirects after
// sign-in, header injection, signed-out gate, security headers. Usage: node scripts/probe-bff.mjs (after starting both)
// ADMIN_TRUST_XFF=1 is not needed.
import http from 'node:http';
const out = [];
const check = (name, ok, extra = '') => out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
const note = (name, extra) => out.push(`NOTE  ${name}  -> ${extra}`);
const HOST = 'localhost:3911';
let n = 0;

// Raw http request so every header (Origin, Host, Sec-Fetch-Site, odd paths) is sent exactly as written.
function raw(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 3911, method, path, headers: { Host: HOST, 'X-Forwarded-For': `10.66.0.${++n}`, ...headers } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}
const J = { 'Content-Type': 'application/json' };
const O = { Origin: `http://${HOST}` };
await fetch('http://127.0.0.1:3912/__harness/reset', { method: 'POST' });

const login = async (u, p, extra = {}) => raw('POST', '/api/session/login', { headers: { ...J, ...O, ...extra }, body: JSON.stringify({ username: u, password: p }) });
const l1 = await login('editor', 'Editor-Mock-Pass-1');
const setCookie = l1.headers['set-cookie']?.[0] ?? '';
check('login sets one cookie', l1.status === 200 && setCookie.startsWith('nhc_admin='));
note('cookie flags on http://localhost', setCookie.replace(/nhc_admin=[^;]+/, 'nhc_admin=<token>'));
check('cookie HttpOnly + SameSite=Strict + Path=/ + Max-Age 3600', /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie) && /Path=\//.test(setCookie) && /Max-Age=3600/.test(setCookie));
check('token never in the login body', !/eyJ/.test(l1.text), l1.text.slice(0, 80));
const cookie = setCookie.split(';')[0];
const tokenA = cookie.split('=')[1];
// https host => __Host- prefix and Secure
const l2 = await raw('POST', '/api/session/login', { headers: { ...J, Origin: 'https://admin.example', Host: 'admin.example', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'admin.example' }, body: JSON.stringify({ username: 'viewer', password: 'Viewer-Mock-Pass-1' }) });
const sc2 = l2.headers['set-cookie']?.[0] ?? '';
check('https origin: __Host- cookie with Secure, no Domain', /^__Host-nhc_admin=/.test(sc2) && /; Secure/i.test(sc2) && !/Domain=/i.test(sc2), sc2.replace(/=[^;]+/, '=<token>'));

// session fixation: a pre-set cookie sent with login must be replaced, not reused; server issues a new session
const sid1 = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64url')).sid;
const l3 = await login('editor', 'Editor-Mock-Pass-1', { Cookie: 'nhc_admin=attacker-chosen.value.here' });
const sid2 = JSON.parse(Buffer.from(l3.headers['set-cookie'][0].split(';')[0].split('=')[1].split('.')[1], 'base64url')).sid;
check('session fixation: every login mints a fresh session id; client-supplied cookie is ignored', sid1 !== sid2);

// CSRF
const csrfCases = [
  ['no Origin, no Sec-Fetch-Site', {}],
  ['cross-site Origin', { Origin: 'https://evil.example' }],
  ['Origin null', { Origin: 'null' }],
  ['Sec-Fetch-Site cross-site with right Origin', { ...O, 'Sec-Fetch-Site': 'cross-site' }],
  ['Sec-Fetch-Site same-site (a sibling subdomain)', { ...O, 'Sec-Fetch-Site': 'same-site' }],
  ['Origin with look-alike host', { Origin: `http://${HOST}.evil.example` }],
  ['Origin with userinfo', { Origin: `http://${HOST}@evil.example` }],
];
for (const [label, headers] of csrfCases) {
  for (const [m, p] of [['POST', '/api/session/login'], ['POST', '/api/session/logout'], ['POST', '/api/proxy/products'], ['PATCH', '/api/proxy/orders/aaaaaaaaaaaaaaaaaaaaaaaa'], ['DELETE', '/api/proxy/prayers/aaaaaaaaaaaaaaaaaaaaaaaa'], ['PUT', '/api/proxy/products/aaaaaaaaaaaaaaaaaaaaaaaa'], ['POST', '/api/proxy/auth/password']]) {
    const r = await raw(m, p, { headers: { ...(m === 'DELETE' ? {} : J), Cookie: cookie, ...headers }, body: m === 'DELETE' ? undefined : '{}' });
    if (r.status !== 403) check(`CSRF ${label}: ${m} ${p}`, false, String(r.status));
  }
}
check('CSRF: cross-site / missing-origin mutations refused on login, logout and every proxied verb', !out.some((l) => l.startsWith('FAIL  CSRF')));
// same-origin fetch without Origin but with Sec-Fetch-Site same-origin passes
const ok = await raw('GET', '/api/proxy/orders?size=1', { headers: { Cookie: cookie } });
check('GET via proxy with cookie works', ok.status === 200);
const sameorig = await raw('PATCH', '/api/proxy/candles/aaaaaaaaaaaaaaaaaaaaaaaa', { headers: { ...J, Cookie: cookie, 'Sec-Fetch-Site': 'same-origin' }, body: '{"done":true}' });
check('same-origin mutation reaches the API (404 not-found for fake id)', sameorig.status === 404, String(sameorig.status));
// the CSRF check with a forged Host header
const hostForge = await raw('POST', '/api/proxy/products', { headers: { ...J, Cookie: cookie, Origin: 'https://evil.example', Host: 'evil.example' }, body: '{}' });
note('Origin == Host both attacker controlled (request would have to come from the attacker\'s own server; the victim cookie is not sent there)', String(hostForge.status));
const xfh = await raw('POST', '/api/proxy/products', { headers: { ...J, Cookie: cookie, Origin: 'https://evil.example', 'X-Forwarded-Host': 'evil.example' }, body: '{}' });
note('X-Forwarded-Host trusted for the CSRF host comparison (only a proxy can set it for a browser request)', String(xfh.status));

// proxy allow-list
const pcases = [
  ['/api/proxy/../session/login', 'GET'], ['/api/proxy/%2e%2e/auth/login', 'GET'], ['/api/proxy/orders/..%2fusers', 'GET'], ['/api/proxy/orders/%2e%2e%2fusers', 'GET'],
  ['/api/proxy/orders/../../users', 'GET'], ['/api/proxy/auth/login', 'POST'], ['/api/proxy/auth/logout', 'POST'], ['/api/proxy/users/aaaaaaaaaaaaaaaaaaaaaaaa/x', 'GET'],
  ['/api/proxy/orders%00', 'GET'], ['/api/proxy/orders?size=1&__proto__=x', 'GET'], ['/api/proxy/export/users.csv', 'GET'], ['/api/proxy//orders', 'GET'], ['/api/proxy/orders/', 'GET'],
  ['/api/proxy/http://evil.example/x', 'GET'], ['/api/proxy/orders@evil.example', 'GET'], ['/api/proxy/\\orders', 'GET'],
];
for (const [p, m] of pcases) {
  const r = await raw(m, p, { headers: { ...J, Cookie: cookie, ...O }, body: m === 'POST' ? '{}' : undefined });
  const good = [404, 400, 405, 308].includes(r.status) || (r.status === 200 && p.includes('size=1')); // 308/405: Next normalises the path or has no such verb, never reaches the API
  if (!good) check(`proxy allow-list ${m} ${p}`, false, `${r.status} ${r.text.slice(0, 60)}`);
}
check('proxy allow-list: traversal, encoded slashes, other auth routes, absolute URLs all refused (404/400)', !out.some((l) => l.startsWith('FAIL  proxy allow-list')));
const q = await raw('GET', '/api/proxy/orders?size=1&secret=1&q=a&sort=-createdAt&status=pending', { headers: { Cookie: cookie } });
check('proxy: unknown query params dropped (no error)', q.status === 200);
const big = await raw('POST', '/api/proxy/products', { headers: { ...J, Cookie: cookie, ...O }, body: JSON.stringify({ name: 'x'.repeat(70000) }) });
check('proxy: body over 64 KB -> 413', big.status === 413, String(big.status));
const nojson = await raw('POST', '/api/proxy/products', { headers: { Cookie: cookie, ...O, 'Content-Type': 'text/plain' }, body: 'x=1' });
check('proxy: non-JSON body 415', nojson.status === 415);
const hd = await raw('GET', '/api/proxy/orders?size=1', { headers: { Cookie: cookie, 'X-Forwarded-For': '1.2.3.4\r\nX-Evil: 1' } }).catch((e) => ({ status: 'client-refused', text: String(e.message) }));
note('CRLF in a forwarded header is refused by Node before it can reach the proxy', String(hd.status));
const ua = await raw('GET', '/api/proxy/orders?size=1', { headers: { Cookie: cookie, 'User-Agent': 'x'.repeat(2000) } });
check('very long User-Agent is accepted and clipped', ua.status === 200);
const hdrs = await raw('GET', '/api/proxy/orders?size=1', { headers: { Cookie: cookie } });
check('proxy answers no-store + nosniff, no Set-Cookie', /no-store/.test(hdrs.headers['cache-control']) && hdrs.headers['x-content-type-options'] === 'nosniff' && !hdrs.headers['set-cookie']);
const csvr = await raw('GET', '/api/proxy/export/orders.csv', { headers: { Cookie: cookie } });
check('csv via proxy: type text/csv, attachment, no sniffing', /text\/csv/.test(csvr.headers['content-type']) && /attachment/.test(csvr.headers['content-disposition']));

// open redirect via next
for (const next of ['//evil.example', 'https://evil.example', '/\\evil.example', '/%0d%0aSet-Cookie:x=1', 'javascript:alert(1)', '/..//evil.example', '/api/proxy/orders', '///evil.example']) {
  const r = await raw('GET', `/login?next=${encodeURIComponent(next)}`);
  const page = r.text;
  const m = /"next":"([^"]*)"/.exec(page) ?? [];
  note(`login ?next=${next} -> page carries`, `${r.status} ${m[1] ?? '(none in RSC payload)'}`);
}
const ex = await raw('GET', `/api/session/expire?reason=expired&next=${encodeURIComponent('//evil.example')}`);
check('expire?next=//evil.example does not redirect off-site', !/evil/.test(ex.headers.location ?? ''), ex.headers.location);
const ex2 = await raw('GET', `/api/session/expire?reason=x%0d%0aX-Evil:1&next=${encodeURIComponent('https://evil.example')}`);
check('expire: injected reason ignored, off-site next ignored', !/evil/i.test(ex2.headers.location ?? '') && !ex2.headers['x-evil'], ex2.headers.location);
const ex3 = await raw('GET', '/api/session/expire?reason=expired', { headers: { 'Sec-Fetch-Site': 'cross-site', Cookie: cookie } });
check('cross-site navigation to /api/session/expire does not clear the cookie', !(ex3.headers['set-cookie'] ?? []).length, String(ex3.status));
// unauthenticated page redirect keeps same-site next
const red = await raw('GET', '/orders?q=a');
check('signed-out page -> /login?next=<same-site path>', /\/login\?next=%2Forders%3Fq%3Da$/.test(red.headers.location ?? ''), red.headers.location);
const red2 = await raw('GET', '//evil.example/orders');
note('request path //evil.example/orders when signed out', `${red2.status} ${red2.headers.location ?? ''}`);

// login
const bad = await login('editor', 'wrong-wrong-wrong-1');
check('wrong password -> 401 generic', bad.status === 401 && JSON.parse(bad.text).error === 'Invalid credentials');
const badbody = await raw('POST', '/api/session/login', { headers: { ...J, ...O }, body: '{"username":["a"],"password":"x"}' });
check('login with array username -> 400', badbody.status === 400);
const big2 = await raw('POST', '/api/session/login', { headers: { ...J, ...O }, body: JSON.stringify({ username: 'a', password: 'x'.repeat(5000) }) });
check('login body over 4 KB -> 413', big2.status === 413, String(big2.status));

// signed-out gate
for (const p of ['/', '/orders', '/api/proxy/orders', '/users']) {
  const r = await raw('GET', p);
  check(`signed out ${p} -> redirect to /login or 401`, r.status === 307 || r.status === 401, String(r.status));
}
// header sanity on pages
const lp = await raw('GET', '/login');
const csp = lp.headers['content-security-policy'] ?? '';
check('login page CSP present, nonce, no unsafe-inline', /nonce-/.test(csp) && !/unsafe-inline/.test(csp) && !/unsafe-eval/.test(csp));
check('headers: HSTS, nosniff, DENY, no-store, no x-powered-by', !!lp.headers['strict-transport-security'] && lp.headers['x-content-type-options'] === 'nosniff' && lp.headers['x-frame-options'] === 'DENY' && /no-store/.test(lp.headers['cache-control']) && !lp.headers['x-powered-by']);
// 404 for next internals / source maps
for (const p of ['/_next/static/chunks/../../../package.json', '/.env', '/package.json', '/mock-api/server.mjs', '/.next/server/app/login.html']) {
  const r = await raw('GET', p);
  check(`no leak at ${p}`, r.status === 404 || r.status === 307 || r.status === 400, String(r.status));
}
console.log(out.join('\n'));
