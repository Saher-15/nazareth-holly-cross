// The storefront's categories and materials (server/services/catalog.js). A module of plain constants on purpose: the
// shop's filter panel runs in the browser, and importing them from lib/api.ts pulled that file's full zod schemas into
// the page's JavaScript (docs/PERFORMANCE.md).

export const CATEGORIES = [
  'rosaries',
  'necklaces',
  'bracelets',
  'stained-glass',
  'crosses',
  'bibles',
  'holy-land',
  'gifts',
] as const;
export type Category = (typeof CATEGORIES)[number];
export const MATERIALS = ['gold', 'silver', 'wood', 'glass'] as const;
export type Material = (typeof MATERIALS)[number];
