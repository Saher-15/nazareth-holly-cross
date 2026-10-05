import { describe, it, expect, vi, beforeEach } from 'vitest';

const importConfig = async () => {
  vi.resetModules();
  return import('../config/env.js');
};

describe('config/env', () => {
  beforeEach(() => {
    delete process.env.ENVIRONMENT;
  });

  it('defaults PayPal to sandbox', async () => {
    const { config } = await importConfig();
    expect(config.paypal.environment).toBe('sandbox');
    expect(config.paypal.baseUrl).toBe('https://api-m.sandbox.paypal.com');
  });

  it('uses the live PayPal API only when ENVIRONMENT=production', async () => {
    process.env.ENVIRONMENT = 'production';
    const { config } = await importConfig();
    expect(config.paypal.baseUrl).toBe('https://api-m.paypal.com');
  });

  it('reports missing required variables', async () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    const { missingEnv } = await importConfig();
    expect(missingEnv()).toEqual(['JWT_SECRET']);
    process.env.JWT_SECRET = saved;
  });
});
