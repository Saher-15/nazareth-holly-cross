// Cross-checks GET /admin/dashboard against the same data read through the list routes (an independent computation:
// totals, revenue, the 30 days in Nazareth time, the best sellers, low stock). Run with the harness up:
//   node scripts/check-dashboard-numbers.mjs        (API at http://127.0.0.1:3912, accounts: server/test-harness/README.md)
const API = process.env.API ?? 'http://127.0.0.1:3912';
const login = await (await fetch(`${API}/admin/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.1.2.3' }, body: JSON.stringify({ username: 'owner', password: 'Owner-Mock-Pass-1' }) })).json();
const get = async (p) => (await fetch(`${API}/admin/${p}`, { headers: { Authorization: `Bearer ${login.token}` } })).json();
const all = async (resource) => {
  const items = [];
  for (let page = 1; ; page += 1) {
    const r = await get(`${resource}?size=100&page=${page}`);
    items.push(...r.items);
    if (items.length >= r.total) return items;
  }
};
const dash = await get('dashboard');
const [orders, candles, contacts, products] = await Promise.all([all('orders'), all('candles'), all('contacts'), all('products')]);
const day = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const round2 = (n) => Math.round(n * 100) / 100;
const problems = [];
const eq = (name, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${name}: dashboard ${JSON.stringify(a)} vs recomputed ${JSON.stringify(b)}`); };
eq('orders', dash.totals.orders, orders.length);
eq('ordersPending', dash.totals.ordersPending, orders.filter((o) => !o.done).length);
// Revenue counts verified payments only; the unverified orders are counted apart (review 04 finding 9).
const verified = (o) => o.paymentVerified === true;
eq('revenue', dash.totals.revenue, round2(orders.filter(verified).reduce((s, o) => s + o.totalPrice, 0)));
eq('revenueUnverified', dash.totals.revenueUnverified, round2(orders.filter((o) => !verified(o)).reduce((s, o) => s + o.totalPrice, 0)));
eq('ordersUnverified', dash.totals.ordersUnverified, orders.filter((o) => !verified(o)).length);
eq('candles', dash.totals.candles, candles.length);
eq('candlesPending', dash.totals.candlesPending, candles.filter((c) => !c.done).length);
eq('contacts', dash.totals.contacts, contacts.length);
eq('contactsOpen', dash.totals.contactsOpen, contacts.filter((c) => !c.done).length);
eq('products', dash.totals.products, products.length);
for (const d of dash.last30Days) {
  const mine = orders.filter((o) => day(o.createdAt) === d.date);
  eq(`day ${d.date} orders`, d.orders, mine.length);
  eq(`day ${d.date} revenue`, d.revenue, round2(mine.filter(verified).reduce((s, o) => s + o.totalPrice, 0)));
  eq(`day ${d.date} candles`, d.candles, candles.filter((c) => day(c.createdAt) === d.date).length);
}
const sold = new Map();
for (const o of orders) for (const l of o.products) sold.set(l.productID, (sold.get(l.productID) ?? 0) + l.quantity);
const top = [...sold].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 5).map(([id, n]) => ({ id, sold: n, revenue: round2(n * products.find((p) => p._id === id).price) }));
eq('top products', dash.topProducts.map((p) => ({ id: p.productId, sold: p.sold, revenue: p.revenue })), top);
eq('low stock', dash.lowStock.map((p) => p.productId), products.filter((p) => typeof p.stock === 'number' && p.stock <= 5).sort((a, b) => a.stock - b.stock || (a.name < b.name ? -1 : 1)).slice(0, 20).map((p) => p._id));
eq('recent orders', dash.recent.orders.map((o) => o._id), [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((o) => o._id));
console.log(problems.length ? `FAIL\n${problems.join('\n')}` : `PASS: dashboard matches the lists (${orders.length} orders, revenue ${dash.totals.revenue}, ${dash.last30Days.length} days, ${dash.topProducts.length} top products, ${dash.lowStock.length} low stock)`);
process.exit(problems.length ? 1 : 0);
