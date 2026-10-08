// Roles of the admin API and what each one may do. The server enforces this per route (requireRole);
// the UI only hides what the server would refuse, so a stale or tampered UI can never widen access.

export const ROLES = ['owner', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export type Capability =
  | 'write' // create / update / delete products, orders, candles, contacts, reviews, prayers
  | 'export' // GET /admin/export/*.csv (a bulk copy of personal data: editor and owner, not viewer)
  | 'deleteOrders' // DELETE /admin/orders/:id
  | 'manageUsers' // /admin/users
  | 'viewAudit' // /admin/audit
  | 'managePrivacy' // /admin/privacy: look up and erase a customer's personal data
  | 'broadcast' // /admin/live: start and stop a live broadcast (docs/LIVE.md)
  | 'managePricing'; // PUT /admin/settings/candle-price: what customers are charged for a candle (owner only)

const CAPABILITIES: Record<Role, readonly Capability[]> = {
  owner: ['write', 'export', 'deleteOrders', 'manageUsers', 'viewAudit', 'managePrivacy', 'broadcast', 'managePricing'],
  editor: ['write', 'export', 'broadcast'],
  viewer: [],
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[role].includes(capability);
}

/** Pages of the dashboard, with the capability a role needs to see the navigation entry. */
export type NavId =
  | 'dashboard'
  | 'live'
  | 'orders'
  | 'payments'
  | 'candles'
  | 'contacts'
  | 'products'
  | 'pricing'
  | 'candleVideos'
  | 'reviews'
  | 'prayers'
  | 'users'
  | 'audit'
  | 'privacy'
  | 'settings'
  | 'profile';

export const NAV: readonly { id: NavId; href: string; needs?: Capability }[] = [
  { id: 'dashboard', href: '/' },
  { id: 'live', href: '/live', needs: 'broadcast' },
  { id: 'orders', href: '/orders' },
  { id: 'payments', href: '/payments' },
  { id: 'candles', href: '/candles' },
  { id: 'contacts', href: '/contacts' },
  { id: 'products', href: '/products' },
  { id: 'pricing', href: '/pricing' },
  { id: 'candleVideos', href: '/candle-videos' },
  { id: 'reviews', href: '/reviews' },
  { id: 'prayers', href: '/prayers' },
  { id: 'users', href: '/users', needs: 'manageUsers' },
  { id: 'audit', href: '/audit', needs: 'viewAudit' },
  { id: 'privacy', href: '/privacy', needs: 'managePrivacy' },
  { id: 'settings', href: '/settings' },
  { id: 'profile', href: '/profile' },
];

export function navFor(role: Role | null | undefined) {
  return NAV.filter((item) => !item.needs || can(role, item.needs));
}

/** The capability a page needs, or undefined when every signed-in role may open it. */
export function pageNeeds(pathname: string): Capability | undefined {
  const entry = NAV.find((item) => item.href !== '/' && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
  return entry?.needs;
}
