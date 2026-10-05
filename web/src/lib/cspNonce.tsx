'use client';

import { createContext, useContext, type ReactNode } from 'react';

// The Content-Security-Policy nonce of the current request (set by src/proxy.ts). Client components
// that start a third-party script (the PayPal SDK) pass it on, so the script's own tags are allowed too.
const CspNonceContext = createContext<string | undefined>(undefined);

export function CspNonceProvider({ nonce, children }: { nonce: string | undefined; children: ReactNode }) {
  return <CspNonceContext.Provider value={nonce}>{children}</CspNonceContext.Provider>;
}

export const useCspNonce = () => useContext(CspNonceContext);
