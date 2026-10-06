// Admin roles, from the most to the least powerful (docs/ADMIN.md has the full table).
//   owner   everything, including user accounts, the audit log and deleting orders
//   editor  products, orders, candles, contacts, reviews, prayers (read, change, delete) and CSV export
//   viewer  read-only
export const ROLES = ['owner', 'editor', 'viewer'];

const RANK = { viewer: 1, editor: 2, owner: 3 };

export const isRole = (value) => typeof value === 'string' && Object.hasOwn(RANK, value);

// The role an account actually has. Accounts created before roles existed have none and are owners (their
// documents are still valid); a value that is not one of the three roles is damaged data and gives no access (null).
export const effectiveRole = (admin) => {
  const role = admin?.role;
  if (role === undefined || role === null) return 'owner';
  return isRole(role) ? role : null;
};

// True when `role` is at least as powerful as `minimum`.
export const atLeast = (role, minimum) => isRole(role) && isRole(minimum) && RANK[role] >= RANK[minimum];
