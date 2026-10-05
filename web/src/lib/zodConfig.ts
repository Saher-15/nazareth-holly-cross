import { z } from 'zod';

// Zod compiles object schemas into specialised functions when the page may call `new Function`, and finds out
// by trying it. Our Content-Security-Policy forbids eval (no 'unsafe-eval', see src/lib/csp.ts), so the probe
// itself is reported as a violation on every page that validates something in the browser. Turning the
// compiler off skips the probe; the schemas here are small and validation is not a hot path.
// Imported by every module that creates a schema, before it does.
z.config({ jitless: true });
