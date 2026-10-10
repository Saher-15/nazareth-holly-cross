import { config } from 'zod/mini';

// Zod compiles object schemas into specialised functions when the page may call `new Function`, and finds out
// by trying it. Our Content-Security-Policy forbids eval (no 'unsafe-eval', see src/lib/csp.ts), so the probe
// itself is reported as a violation on every page that validates something in the browser. Turning the
// compiler off skips the probe; the schemas here are small and validation is not a hot path.
// Imported by every module that creates a schema, before it does.
//
// `config` is imported from `zod/mini` on purpose: the setting lives in Zod's shared core, so it applies to the
// full `zod` API on the server too, while a browser module that imports this file does not pull the whole
// library (with all its locales, about 70 kB compressed) into every page. Browser code uses `zod/mini` only;
// `web/scripts/scan-bundle.mjs` fails the build check when the full library reaches a browser chunk.
config({ jitless: true });
