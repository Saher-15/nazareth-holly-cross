// Env the routes read at import time; no real services are contacted in tests.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.MAIL_FROM = 'test@example.com';
process.env.MAIL_APP_PASSWORD = 'x';
process.env.CLIENT_ID = 'test-client-id';
process.env.CLIENT_SECRET = 'test-client-secret';
process.env.DATABASEURL = 'mongodb://127.0.0.1:1/unused';

// The payment ledger (model/payment.js) is written by the payment routes. Tests never talk to MongoDB, so every test
// file gets an in-memory Payment unless it mocks the model itself.
import { vi } from 'vitest';

vi.mock('../model/payment.js', async (importOriginal) => {
  const { fakeModule } = await import('./helpers/fakes.js');
  // The constants (PAYMENT_GRACE_MS, PAYMENT_TYPES, ...) stay real; only the model is replaced.
  return {
    ...(await importOriginal()),
    ...fakeModule('Payment', {
      collection: 'payment',
      timestamps: true,
      unique: ['paypalOrderId'],
      defaults: { currency: 'USD', status: 'created', capturedAt: null, resolvedAt: null },
    }),
  };
});
