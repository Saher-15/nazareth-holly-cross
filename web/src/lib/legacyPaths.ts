// Addresses of the previous site (search results and shared links still use them) and where each lives now,
// without a language. src/proxy.ts answers them with ONE permanent redirect (308) to the page in the visitor's
// language; next.config.ts keeps the same rules for the language-prefixed forms (/en/latin).
// A small list of its own on purpose: the proxy runs on every request (an edge function on Netlify) and must not
// import the holy-site data. tests/unit/legacy-redirects.test.ts keeps it in step with that data.

/** The holy sites of the old site, now /sites/<slug>. */
export const LEGACY_PLACE_SLUGS = ['latin', 'greek', 'maryswell', 'oldcity', 'city'] as const;

const ONE_SEGMENT: Readonly<Record<string, string>> = {
  ...Object.fromEntries(LEGACY_PLACE_SLUGS.map((slug) => [`/${slug}`, `/sites/${slug}`])),
  '/checkoutcandle': '/candle',
  '/checkoutdonation': '/donate',
};

/** The new path (without a language) of an old address, or null when `pathname` is not one. */
export function legacyTarget(pathname: string): string | null {
  const direct = ONE_SEGMENT[pathname];
  if (direct) return direct;
  const product = /^\/product\/([^/]+)$/.exec(pathname);
  return product ? `/shop/${product[1]}` : null;
}
