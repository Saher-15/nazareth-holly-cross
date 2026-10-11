import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SideCart from '@/components/shop/SideCart';
import { CartProvider } from '@/lib/cart';
import en from '@/messages/en.json';
import he from '@/messages/he.json';

// The cart on every page (components/shop/SideCart.tsx): a side tab with the count and total, and a panel.
let pathname = '/shop';
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => pathname,
  Link: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const FISH = '66c9e1266552e5d9f5249600';
const store = (lines: unknown[]) => localStorage.setItem('nhc.cart.v1', JSON.stringify(lines));
const line = (color: string, quantity: number) => ({ _id: FISH, name: 'Vitrage glass fish', price: 50, img: '', color, quantity });
const show = (locale: 'en' | 'he' = 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : he} timeZone="Asia/Jerusalem">
      <CartProvider>
        <SideCart />
      </CartProvider>
    </NextIntlClientProvider>,
  );

describe('side cart', () => {
  beforeEach(() => {
    pathname = '/shop';
    localStorage.clear();
    // jsdom has no <dialog> methods: open and close it the way a browser does (with the close event).
    Object.assign(HTMLDialogElement.prototype, {
      showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); },
      close(this: HTMLDialogElement) {
        if (!this.hasAttribute('open')) return;
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    });
  });
  afterEach(() => {
    cleanup();
    const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
    delete proto.showModal;
    delete proto.close;
  });

  it('is not shown while the cart is empty', async () => {
    show();
    await Promise.resolve();
    expect(screen.queryByTestId('side-cart-tab')).toBeNull();
  });

  it('shows the count and the total on the tab, one line per colour in the panel, and the same totals as the cart page', async () => {
    store([line('green', 2), line('cyan', 1)]);
    show();
    const tab = await screen.findByTestId('side-cart-tab');
    expect(tab.getAttribute('aria-label')).toBe('View cart: 3 items');
    expect(tab.textContent).toContain('3');
    expect(tab.textContent).toContain('$140.00'); // 150 - 10% + 5 shipping
    fireEvent.click(tab);
    const panel = screen.getByTestId('side-cart');
    expect(panel.hasAttribute('open')).toBe(true);
    const rows = within(panel).getAllByTestId('side-cart-line');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Colour: green');
    expect(rows[1].textContent).toContain('Colour: cyan');
    expect(within(panel).getByTestId('side-cart-total').textContent).toBe('$140.00');
    expect(within(panel).getByRole('link', { name: 'Checkout' }).getAttribute('href')).toBe('/checkout');
  });

  it('changes a quantity and removes a line from the panel, and the tab follows', async () => {
    store([line('green', 1), line('cyan', 1)]);
    show();
    fireEvent.click(await screen.findByTestId('side-cart-tab'));
    const panel = screen.getByTestId('side-cart');
    fireEvent.click(within(panel).getAllByRole('button', { name: /increase|more|\+/i })[0]);
    expect(within(panel).getByTestId('side-cart-total').textContent).toBe('$140.00'); // 3 × 50 = 150
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Remove Vitrage glass fish' })[1]);
    expect(within(panel).getAllByTestId('side-cart-line')).toHaveLength(1);
    expect(screen.getByTestId('side-cart-tab').getAttribute('aria-label')).toBe('View cart: 2 items');
  });

  it.each(['/cart', '/checkout'])('is not on %s (the cart is already there)', async (path) => {
    pathname = path;
    store([line('green', 1)]);
    show();
    await Promise.resolve();
    expect(screen.queryByTestId('side-cart-tab')).toBeNull();
  });

  it('is translated (Hebrew)', async () => {
    store([line('green', 1)]);
    show('he');
    fireEvent.click(await screen.findByTestId('side-cart-tab'));
    expect(screen.getByRole('button', { name: 'סגירת סל הקניות' })).toBeTruthy();
  });
});

describe('moving the side cart', () => {
  beforeEach(() => {
    pathname = '/shop';
    localStorage.clear();
    Object.assign(HTMLDialogElement.prototype, {
      showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); },
      close(this: HTMLDialogElement) { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); this.dispatchEvent(new Event('close')); },
    });
  });
  afterEach(() => {
    cleanup();
    const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
    delete proto.showModal;
    delete proto.close;
  });

  it('a drag moves it to the nearer side and the height it was dropped at, remembers it, and does not open the cart', async () => {
    store([line('green', 1)]);
    show();
    const tab = await screen.findByTestId('side-cart-tab');
    fireEvent.pointerDown(tab, { button: 0, clientX: 1000, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 600, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 40, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(tab, { clientX: 40, clientY: 200, pointerId: 1 });
    fireEvent.click(tab);
    expect(screen.getByTestId('side-cart').hasAttribute('open')).toBe(false);
    expect(tab.getAttribute('data-side')).toBe('left');
    expect(JSON.parse(localStorage.getItem('nhc.sideCart.place.v1') ?? 'null')).toMatchObject({ side: 'left' });
  });

  it('a short movement is a click: it opens the cart', async () => {
    store([line('green', 1)]);
    show();
    const tab = await screen.findByTestId('side-cart-tab');
    fireEvent.pointerDown(tab, { button: 0, clientX: 1000, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 1003, clientY: 402, pointerId: 1 });
    fireEvent.pointerUp(tab, { clientX: 1003, clientY: 402, pointerId: 1 });
    fireEvent.click(tab);
    expect(screen.getByTestId('side-cart').hasAttribute('open')).toBe(true);
  });

  it('without dragging: the panel button moves it to the other side, and back', async () => {
    store([line('green', 1)]);
    show();
    fireEvent.click(await screen.findByTestId('side-cart-tab'));
    const move = screen.getByRole('button', { name: 'Move the cart button to the other side' });
    fireEvent.click(move);
    expect(screen.getByTestId('side-cart-tab').getAttribute('data-side')).toBe('left');
    fireEvent.click(move);
    expect(screen.getByTestId('side-cart-tab').getAttribute('data-side')).toBe('right');
  });

  it('starts where the visitor left it last time, and ignores a damaged value', async () => {
    localStorage.setItem('nhc.sideCart.place.v1', JSON.stringify({ side: 'left', y: 0.3 }));
    store([line('green', 1)]);
    show();
    expect((await screen.findByTestId('side-cart-tab')).getAttribute('data-side')).toBe('left');
    cleanup();
    localStorage.setItem('nhc.sideCart.place.v1', '{not json');
    show();
    expect((await screen.findByTestId('side-cart-tab')).getAttribute('data-side')).toBe('default');
  });
});
