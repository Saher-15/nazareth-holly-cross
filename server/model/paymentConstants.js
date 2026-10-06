// The payment ledger's vocabulary (model/payment.js). Kept apart from the model so the services and the local test
// harness (which swaps every model for an in-memory copy) can read it without loading Mongoose.

export const PAYMENT_TYPES = ['order', 'candle', 'donation', 'unknown']; // 'unknown': a legacy client that sent no type
export const PAYMENT_STATUSES = ['created', 'captured', 'failed'];
export const LINK_KINDS = ['order', 'candle'];

// A captured order/candle payment that is still not linked to a saved record after this long is "unfulfilled": the
// customer has paid and the shop has nothing to ship or light. Before that the browser is simply still posting it.
export const PAYMENT_GRACE_MS = 10 * 60 * 1000;
