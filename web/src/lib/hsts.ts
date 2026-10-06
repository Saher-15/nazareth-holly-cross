// The Strict-Transport-Security value of the site: two years, every subdomain, and eligible for the browsers'
// preload list (https://hstspreload.org). One constant, used by the page headers (next.config.ts) and by the
// redirects the language proxy answers (src/proxy.ts), so the two can never disagree.
//
// Why the redirects too: Netlify adds its own `max-age=31536000` (one year, no includeSubDomains, no preload) to a
// response that has no such header, and "/" itself is a redirect to the visitor's language. hstspreload.org reads
// the header of that first answer, so without this the site could never pass its check.
//
// Do not submit the domain to the preload list lightly: removal takes months. Every subdomain of
// nazarethholycross.com must serve https for good first (docs/INFRASTRUCTURE.md).
export const HSTS_VALUE = 'max-age=63072000; includeSubDomains; preload';
