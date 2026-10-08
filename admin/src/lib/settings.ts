import { z } from 'zod';

// GET /admin/settings and PUT /admin/settings/candle-price (server/route/admin/settings.js, docs/ADMIN.md "Settings").
export const siteSettingsSchema = z.object({
  candlePrice: z.number().positive(),
  candlePriceMin: z.number().positive(),
  candlePriceMax: z.number().positive(),
  currency: z.literal('USD'),
  updatedAt: z.string().nullable(),
  updatedBy: z.string(),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/** A price typed by a person ("5", "5.5", "5,50") as a number of dollars and cents, or null when it is not one. */
export function parsePrice(text: string): number | null {
  const normal = text.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normal)) return null;
  const value = Number(normal);
  return Number.isFinite(value) ? value : null;
}
