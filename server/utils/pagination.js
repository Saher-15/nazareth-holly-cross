// Reads that used to return a whole collection (the old admin site and the storefront call them) keep their answer
// shape, a plain array, but are capped: one oversized collection must not be able to exhaust the API's memory.
// The paginated `/admin/<resource>` routes (docs/ADMIN.md) are the way to read everything.
export const LEGACY_LIST_CAP = 5000;

// Sends a capped array. When the cap was reached the answer says so (X-Result-Capped), so a client can tell
// "5000 rows" from "the first 5000 rows".
export function sendCapped(res, docs, cap = LEGACY_LIST_CAP) {
  if (docs.length >= cap) res.set('X-Result-Capped', String(cap));
  return res.status(200).send(docs);
}
