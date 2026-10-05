import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { clearApiMemory } from '@/lib/api';

// Stored API answers (src/lib/api.ts) must not leak from one test into the next.
beforeEach(() => clearApiMemory());
