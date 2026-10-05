'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { orderSummary } from './pricing';

// The shopping cart: kept in the browser (localStorage), one line per product + colour.

export type CartLine = {
  _id: string;
  name: string;
  price: number;
  img: string;
  color: string;
  quantity: number;
};

export type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'quantity'>; quantity?: number }
  | { type: 'setQuantity'; _id: string; color: string; quantity: number }
  | { type: 'remove'; _id: string; color: string }
  | { type: 'clear' }
  | { type: 'load'; lines: CartLine[] };

export const MAX_LINE_QUANTITY = 50; // the API refuses more per product
const STORAGE_KEY = 'nhc.cart.v1';

const sameLine = (a: { _id: string; color: string }, b: { _id: string; color: string }) =>
  a._id === b._id && a.color === b.color;
const clamp = (n: number) => Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(n)));

export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const add = clamp(action.quantity ?? 1);
      if (add === 0) return lines;
      const existing = lines.find((l) => sameLine(l, action.line));
      if (existing) {
        return lines.map((l) => (sameLine(l, action.line) ? { ...l, quantity: clamp(l.quantity + add) } : l));
      }
      return [...lines, { ...action.line, quantity: add }];
    }
    case 'setQuantity': {
      const quantity = clamp(action.quantity);
      return quantity === 0
        ? lines.filter((l) => !sameLine(l, action))
        : lines.map((l) => (sameLine(l, action) ? { ...l, quantity } : l));
    }
    case 'remove':
      return lines.filter((l) => !sameLine(l, action));
    case 'clear':
      return [];
    case 'load':
      return action.lines;
    default:
      return lines;
  }
}

function readStored(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        l && typeof l._id === 'string' && typeof l.price === 'number' && Number.isInteger(l.quantity),
    );
  } catch {
    return [];
  }
}

type CartContextValue = {
  lines: CartLine[];
  ready: boolean; // false until the stored cart has been read (avoids a flash of "empty cart")
  count: number;
  summary: ReturnType<typeof orderSummary>;
  dispatch: (action: CartAction) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

type CartState = { lines: CartLine[]; ready: boolean };

// `ready` turns true once the stored cart has been loaded into state.
function stateReducer(state: CartState, action: CartAction): CartState {
  const lines = cartReducer(state.lines, action);
  return action.type === 'load' ? { lines, ready: true } : { ...state, lines };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [{ lines, ready }, dispatch] = useReducer(stateReducer, { lines: [], ready: false });

  useEffect(() => {
    dispatch({ type: 'load', lines: readStored() });
    // Keep several open tabs in step.
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && dispatch({ type: 'load', lines: readStored() });
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // private mode or full storage: the cart still works for this visit
    }
  }, [lines, ready]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      summary: orderSummary(lines),
      dispatch,
    }),
    [lines, ready],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
