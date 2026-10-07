import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { locales } from '@/i18n/routing';
import { isProductId } from '@/components/shop/catalog';
import { CATALOG_TAG } from '@/lib/api';

// POST /api/revalidate: the API (server/services/siteRefresh.js) calls this right after a product was created, changed
// or deleted in the admin dashboard, so the shop shows it at once instead of after the catalogue's 10-minute cache.
//
//   Authorization: Bearer <REVALIDATE_SECRET>        the same random value (32 characters or more) on Render and Netlify
//   { "scope": "shop", "productIds": ["<24 hex>", ...] }
//
// It drops the cached catalogue (every shop list, product page and the home page's best sellers read it) and the pages
// of the named products; the next visitor gets fresh ones. Nothing else can be asked: no path, no tag from outside.
// Without REVALIDATE_SECRET on this deploy the route answers 404 (it does not exist), so it cannot be probed.
// The secret is compared in constant time (both sides hashed first) and never logged or echoed.

const MIN_SECRET = 32;
const MAX_BODY = 4096;

const digest = (value: string) => createHash('sha256').update(value).digest();

function authorised(header: string | null, secret: string): boolean {
  const match = /^Bearer (.+)$/.exec(header ?? '');
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(secret));
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const secret = (process.env.REVALIDATE_SECRET ?? '').trim();
  if (secret.length < MIN_SECRET) return json(404, { error: 'Not found' });
  if (!authorised(request.headers.get('authorization'), secret)) return json(401, { error: 'Unauthorized' });

  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { error: 'Too large' });
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const raw = (body as { productIds?: unknown } | null)?.productIds;
  const ids = Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && isProductId(id)))].slice(0, 50) : [];

  // { expire: 0 }: the next request reads the API again instead of being served the old catalogue once more.
  revalidateTag(CATALOG_TAG, { expire: 0 });
  for (const locale of locales) {
    revalidatePath(`/${locale}/shop`);
    for (const id of ids) revalidatePath(`/${locale}/shop/${id}`);
  }
  return json(200, { revalidated: true, products: ids.length });
}
