// Env the routes read at import time; no real services are contacted in tests.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.MAIL_FROM = 'test@example.com';
process.env.MAIL_APP_PASSWORD = 'x';
process.env.CLIENT_ID = 'test-client-id';
process.env.CLIENT_SECRET = 'test-client-secret';
process.env.DATABASEURL = 'mongodb://127.0.0.1:1/unused';
