import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PendingFulfilmentRunner from '@/components/checkout/PendingFulfilmentRunner';
import { ToastProvider } from '@/components/ui/Toast';
import { CartProvider, useCart } from '@/lib/cart';
import { cartSignature, pendingFulfilment, STORAGE_KEY } from '@/lib/pendingFulfilment';
import en from '@/messages/en.json';

// The next visit: a payment whose order was never saved is saved by the page itself, the customer is told, and the
// cart it was paid from is emptied (only that cart).

const ID = 'ABCDEFGHIJ0123456';
const LINE = { _id: '66eb4665c7e03262956c8d1d', name: 'Olive wood cross', price: 20, img: '/x.jpg', color: 'brown', quantity: 2 };

function seedRecord(cart: string) {
  const now = Date.now();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([{
      v: 1, paypalOrderId: ID, kind: 'order', path: '/order/newOrder', body: { firstName: 'Maria' }, cart,
      createdAt: now - 3_600_000, attempts: 3, nextAt: now - 1000, state: 'pending',
    }]),
  );
}

function CartProbe() {
  const { lines } = useCart();
  return <p data-testid="cart">{lines.reduce((n, l) => n + l.quantity, 0)}</p>;
}

const mount = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ToastProvider>
        <CartProvider>
          <PendingFulfilmentRunner />
          <CartProbe />
        </CartProvider>
      </ToastProvider>
    </NextIntlClientProvider>,
  );

const answer = (status: number, body = 'Created') => vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('nhc.cart.v1', JSON.stringify([LINE]));
});
afterEach(async () => {
  cleanup();
  // the engine is one object per page: let the API "come back" so no record outlives its test
  answer(201);
  for (const record of pendingFulfilment.list()) await pendingFulfilment.attempt(record.paypalOrderId, { force: true });
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('PendingFulfilmentRunner (mounted in every page)', () => {
  it('saves a payment left by an earlier visit, thanks the customer with the reference, and empties the cart it was paid from', async () => {
    seedRecord(cartSignature([LINE]));
    answer(201);
    mount();
    await waitFor(() => expect(screen.getByText(`Good news: your earlier payment (${ID}) has now been saved with us. Thank you!`)).toBeInTheDocument());
    expect(screen.getByTestId('cart')).toHaveTextContent('0');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not empty a cart that is not the one that was paid (the customer has started a new purchase)', async () => {
    seedRecord(cartSignature([{ ...LINE, quantity: 5 }]));
    answer(201);
    mount();
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeNull());
    expect(screen.getByTestId('cart')).toHaveTextContent('2');
  });

  it('while the API still cannot save it: says so once, with the reference and the address to write to, and keeps the cart and the record', async () => {
    seedRecord(cartSignature([LINE]));
    answer(503);
    mount();
    await waitFor(() => expect(screen.getByText(new RegExp(`Your earlier payment \\(${ID}\\) is still waiting to be saved`))).toBeInTheDocument());
    expect(screen.getByText(/nazarethholycross@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByTestId('cart')).toHaveTextContent('2');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')[0].attempts).toBe(4);
  });

  it('has nothing to say when nothing is waiting', async () => {
    answer(201);
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(/earlier payment/)).toBeNull();
    expect(screen.getByTestId('cart')).toHaveTextContent('2');
  });

  it('stops its loop when the page goes away', async () => {
    seedRecord(cartSignature([LINE]));
    answer(503);
    const view = mount();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')[0]?.attempts).toBe(4));
    view.unmount();
    const again = pendingFulfilment.start(); // a fresh page can start it again (it would answer with nothing if it still ran)
    expect(again.inherited).toEqual([ID]);
    again.stop();
  });
});
