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

/**
 * An amount of money as a person types it: "1200", "1,200", "1 200", "1200.50", "1200,50", "1.234,50", "1,234.50".
 * A comma or a point followed by exactly three digits groups thousands; a single one followed by one or two digits is
 * the decimal mark. Returns null for what is not an amount (and for a negative one). Arabic-Indic digits are read too.
 */
export function parseAmount(text: string): number | null {
  let s = text.trim().replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  s = s.replace(/[\s\u00a0\u202f'$]/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const last = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (last >= 0) {
    const tail = s.length - last - 1;
    const marks = s.replace(/\d/g, '');
    const decimal = tail >= 1 && tail <= 2 && (marks.length === 1 || marks[marks.length - 1] !== marks[0] || marks.split(marks[0]).length - 1 === 1);
    if (decimal) s = s.slice(0, last).replace(/[.,]/g, '') + '.' + s.slice(last + 1);
    else if (tail === 3) s = s.replace(/[.,]/g, '');
    else return null;
  }
  const value = Number(s);
  return Number.isFinite(value) && value >= 0 ? value : null;
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
