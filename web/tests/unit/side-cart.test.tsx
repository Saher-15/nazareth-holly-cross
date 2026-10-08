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
    expect(screen.getByRole('button', { name: 'סגירת העגלה' })).toBeTruthy();
  });
});
