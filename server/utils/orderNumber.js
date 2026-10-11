// The order number people see and quote: '#' and the last 8 characters of the order's id. The dashboard's list, drawer
// and packing slip, the customer's e-mails and the CSV all use it, and the dashboard's search finds an order by it
// (route/admin/orders.js orderNumberClause). docs/ADMIN.md 4.1.
export const orderNumber = (id) => `#${String(id ?? '').slice(-8)}`;
