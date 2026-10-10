import { z } from 'zod';

// GET /admin/metrics/funnel (server/route/admin/metrics.js, docs/ANALYTICS.md): the sales funnel counted without
// cookies. Counts of EVENTS, not of people: one visitor opening the page twice counts twice.

export const FUNNEL_FLOWS = ['candle', 'order', 'donation'] as const;
export type FunnelFlow = (typeof FUNNEL_FLOWS)[number];
export const FUNNEL_STEPS = ['view', 'cta', 'details', 'pay_start', 'paid'] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

const counts = { view: z.number(), cta: z.number(), details: z.number(), pay_start: z.number(), paid: z.number() };
export const funnelSchema = z.object({
  from: z.string(),
  to: z.string(),
  flow: z.enum(FUNNEL_FLOWS),
  totals: z.object(counts),
  campaigns: z.array(z.object({ source: z.string(), medium: z.string(), campaign: z.string(), ...counts })),
  days: z.array(z.object({ day: z.string(), ...counts })),
  /** Paid candles or orders really saved in the range (the truth); null for a flow that has none (donations). */
  paidConfirmed: z.number().nullable(),
});
export type Funnel = z.infer<typeof funnelSchema>;
export type FunnelCounts = Funnel['totals'];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A day from the address bar, or undefined when it is not one (the API then uses its default range). */
export const dayParam = (value: string | string[] | undefined) => (typeof value === 'string' && DAY.test(value) ? value : undefined);
export const flowParam = (value: string | string[] | undefined): FunnelFlow =>
  typeof value === 'string' && (FUNNEL_FLOWS as readonly string[]).includes(value) ? (value as FunnelFlow) : 'candle';

/** `part` of `whole` as a percentage with one decimal, or null when there is nothing to divide by. */
export function share(part: number, whole: number): number | null {
  if (!(whole > 0) || !Number.isFinite(part)) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/** What one paying customer cost: the money spent on advertising divided by the completed purchases. */
export function costPerCustomer(spend: number, customers: number): number | null {
  if (!Number.isFinite(spend) || spend < 0 || !(customers > 0)) return null;
  return Math.round((spend / customers) * 100) / 100;
}

/** The name of a campaign row: "facebook / paid / easter", or null for visits that came without a campaign link. */
export function campaignName(row: { source: string; medium: string; campaign: string }): string | null {
  const parts = [row.source, row.medium, row.campaign].filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}
