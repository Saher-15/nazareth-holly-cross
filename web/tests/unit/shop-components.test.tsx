import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductCard from '@/components/shop/ProductCard';
import ProductReviewForm from '@/components/shop/ProductReviewForm';
import WishlistButton from '@/components/shop/WishlistButton';
import type { CardItem } from '@/lib/shop/items';
import en from '@/messages/en.json';
import he from '@/messages/he.json';

// The review form must never reach the real API from a unit test.
const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({ postJson }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={`/en${href}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function withIntl(ui: ReactNode, locale: 'en' | 'he' = 'en') {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : he} timeZone="Asia/Jerusalem">
      {ui}
    </NextIntlClientProvider>
  );
}

const item = (over: Partial<CardItem> = {}): CardItem => ({
  _id: '66c70c6387e696939c4ab117',
  name: 'Golden rosary',
  price: 15,
  priceLabel: '$15.00',
  img: '/images/vitrage-bg.jpg',
  category: 'rosaries',
  rating: { avg: 0, count: 0 },
  stock: null,
  variants: 0,
  badges: [],
  ...over,
});

const f = en.shopFeatures;

describe('ProductCard', () => {
  it('shows the category, and no stars or badges when there is nothing to show', () => {
    render(withIntl(<ProductCard item={item()} />));
    const link = screen.getByTestId('product-card');
    expect(link).toHaveAttribute('href', '/en/shop/66c70c6387e696939c4ab117');
    expect(link).toHaveTextContent(f.categories.rosaries);
    expect(screen.queryByTestId('card-rating')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-badge')).not.toBeInTheDocument();
  });

  it('shows stars with the review count, and the badges', () => {
    render(
      withIntl(
        <ProductCard item={item({ rating: { avg: 4.5, count: 12 }, stock: 2, badges: ['bestseller', 'new', 'lowStock'] })} />,
      ),
    );
    const rating = screen.getByTestId('card-rating');
    expect(within(rating).getByRole('img', { name: '4.5 out of 5 stars' })).toBeInTheDocument();
    expect(rating).toHaveTextContent('(12)');
    expect(rating).toHaveTextContent('12 reviews');
    expect(screen.getAllByTestId('card-badge').map((b) => b.textContent)).toEqual(['Best seller', 'New', 'Only 2 left']);
  });

  it('keeps the heart outside the link', () => {
    render(withIntl(<ProductCard item={item()} />));
    const heart = screen.getByRole('button', { name: 'Save Golden rosary to your wishlist' });
    expect(screen.getByTestId('product-card')).not.toContainElement(heart);
  });

  it('can leave the heart out (wishlist page)', () => {
    render(withIntl(<ProductCard item={item()} wishlist={false} />));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('WishlistButton', () => {
  it('toggles, says what changed and keeps the list in the browser', () => {
    render(withIntl(<WishlistButton id="abc" name="Olive oil" />));
    const button = screen.getByRole('button', { name: 'Save Olive oil to your wishlist' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Olive oil was added to your wishlist.');
    expect(JSON.parse(localStorage.getItem('nhc.wishlist.v1') ?? '[]')).toEqual(['abc']);

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('Olive oil was removed from your wishlist.');
    expect(JSON.parse(localStorage.getItem('nhc.wishlist.v1') ?? '[]')).toEqual([]);
  });

  it('speaks Hebrew in Hebrew', () => {
    render(withIntl(<WishlistButton id="abc" name="Olive oil" variant="pill" />, 'he'));
    expect(screen.getByRole('button', { name: he.shopFeatures.wishlist.save })).toBeInTheDocument();
  });
});

describe('ProductReviewForm', () => {
  const form = f.reviews.form;
  const onPosted = vi.fn();
  beforeEach(() => {
    postJson.mockReset();
    onPosted.mockReset();
  });

  const fill = () => {
    fireEvent.change(screen.getByLabelText(form.fields.name), { target: { value: ' Maria ' } });
    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    fireEvent.change(screen.getByLabelText(form.fields.comment), { target: { value: 'Beautiful rosary' } });
  };
  const submit = () => fireEvent.click(screen.getByRole('button', { name: form.submit }));
  const renderForm = () =>
    render(withIntl(<ProductReviewForm productId="66c70c6387e696939c4ab117" productName="Golden rosary" onPosted={onPosted} />));

  it('checks the fields before sending and focuses the first problem', () => {
    renderForm();
    submit();
    expect(postJson).not.toHaveBeenCalled();
    const name = screen.getByLabelText(form.fields.name);
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(form.errors.nameRequired);
    expect(screen.getByText(form.errors.ratingRequired)).toBeInTheDocument();
    expect(screen.getByText(form.errors.commentRequired)).toBeInTheDocument();
  });

  it('posts the review with an empty honeypot and shows it at once', async () => {
    postJson.mockResolvedValue({
      ok: true,
      data: { _id: 'r1', name: 'Maria', country: '', rating: 4, title: '', comment: 'Beautiful rosary', createdAt: '2026-10-05' },
    });
    renderForm();
    fill();
    submit();
    expect(await screen.findByText(form.success)).toBeInTheDocument();
    expect(postJson).toHaveBeenCalledWith('/product/66c70c6387e696939c4ab117/reviews', {
      name: 'Maria',
      country: '',
      rating: 4,
      title: '',
      comment: 'Beautiful rosary',
      website: '',
    });
    expect(onPosted).toHaveBeenCalledWith(expect.objectContaining({ _id: 'r1', rating: 4 }));
  });

  it.each([
    [422, form.errors.invalid],
    [429, form.errors.rateLimited],
    [0, form.errors.network],
    [500, form.errors.server],
  ])('explains an answer of %i and keeps what was written', async (status, message) => {
    postJson.mockResolvedValue({ ok: false, status, error: 'x' });
    renderForm();
    fill();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText(form.fields.comment)).toHaveValue('Beautiful rosary');
    expect(onPosted).not.toHaveBeenCalled();
  });
});
