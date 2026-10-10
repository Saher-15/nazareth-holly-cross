import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { clearApiMemory } from '@/lib/api';

// Stored API answers (src/lib/api.ts) must not leak from one test into the next.
beforeEach(() => clearApiMemory());

// The funnel count (src/lib/track.ts) is silent in unit tests, as it is for a visitor who sent Global Privacy Control:
// components under test never call the API for it. tests/unit/track.test.ts switches it on to test it.
if (typeof window !== "undefined") Object.defineProperty(window.navigator, "globalPrivacyControl", { configurable: true, writable: true, value: true });
