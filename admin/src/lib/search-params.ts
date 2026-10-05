// Helpers for reading Next.js searchParams safely.

export type RawParams = Record<string, string | string[] | undefined>;

export function one(raw: RawParams, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

/** The id of the record to show in the drawer (?open=...), or undefined when missing or not a plain id. */
export function openParam(raw: RawParams): string | undefined {
  const value = one(raw, 'open');
  return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;
}
