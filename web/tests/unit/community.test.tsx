import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewForm from '@/components/community/ReviewForm';
import ReviewWall from '@/components/community/ReviewWall';
import type { Review } from '@/lib/api';
import en from '@/messages/en.json';
import he from '@/messages/he.json';

// The form must never reach the real API or the Next server from a unit test.
const { postJson, revalidateReviews } = vi.hoisted(() => ({ postJson: vi.fn(), revalidateReviews: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({ postJson }));
vi.mock('@/components/community/actions', () => ({ revalidateReviews }));

afterEach(cleanup);

function withIntl(ui: ReactNode, locale: 'en' | 'he' = 'en') {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : he} timeZone="Asia/Jerusalem">
      {ui}
    </NextIntlClientProvider>
  );
}

const review = (over: Partial<Review>): Review => ({
  _id: Math.random().toString(36).slice(2),
  fullName: 'Maria Rossi',
  email: 'Rome, Italy',
  msg: 'A blessed visit.',
  createdAt: '2025-05-02T10:00:00.000Z',
  ...over,
});

describe('ReviewWall', () => {
  it('renders each approved review as a quote card', () => {
    render(withIntl(<ReviewWall titleId="w" reviews={[review({}), review({ fullName: 'Ελένη', email: 'a@b.c' })]} />));
    expect(screen.getByRole('heading', { name: en.pray.messagesTitle })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Rome, Italy')).toBeInTheDocument();
    expect(screen.getAllByText('May 2025')).toHaveLength(2);
    expect(screen.queryByText('a@b.c')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no reviews', () => {
    render(withIntl(<ReviewWall titleId="w" reviews={[]} />));
    expect(screen.getByText(en.pray.noMessages)).toBeInTheDocument();
    expect(screen.getByText(en.communityPage.reviews.emptyHint)).toBeInTheDocument();
  });

  it('says so when the reviews could not be loaded', () => {
    render(withIntl(<ReviewWall titleId="w" reviews={null} />));
    expect(screen.getByText(en.communityPage.reviews.unavailableTitle)).toBeInTheDocument();
  });
});

describe('ReviewForm', () => {
  beforeEach(() => {
    postJson.mockReset();
    revalidateReviews.mockReset().mockResolvedValue(undefined);
  });

  const fill = () => {
    fireEvent.change(screen.getByLabelText(en.pray.placeholderFullName), { target: { value: ' Maria ' } });
    fireEvent.change(screen.getByLabelText(en.pray.placeholderCountry), { target: { value: 'IT' } });
    fireEvent.change(screen.getByLabelText(en.pray.placeholderMessage), { target: { value: 'Thank you!' } });
  };
  const submit = () => fireEvent.click(screen.getByRole('button', { name: en.pray.submitButton }));

  it('validates before sending and focuses the first invalid field', () => {
    render(withIntl(<ReviewForm titleId="f" />));
    submit();
    expect(postJson).not.toHaveBeenCalled();
    const name = screen.getByLabelText(en.pray.placeholderFullName);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveFocus();
    expect(name).toHaveAccessibleDescription(en.communityPage.reviews.form.errors.nameRequired);
  });

  it('posts the review, shows the success state and refreshes the wall', async () => {
    postJson.mockResolvedValue({ ok: true, data: {} });
    render(withIntl(<ReviewForm titleId="f" />));
    fill();
    submit();
    expect(await screen.findByRole('heading', { name: en.pray.successMessage })).toHaveFocus();
    expect(postJson).toHaveBeenCalledWith('/review/addReview', { fullName: 'Maria', place: 'Italy', msg: 'Thank you!' });
    await waitFor(() => expect(revalidateReviews).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: en.communityPage.reviews.form.another }));
    expect(screen.getByLabelText(en.pray.placeholderFullName)).toHaveValue('');
  });

  it('explains a rate limit and keeps what the visitor wrote', async () => {
    postJson.mockResolvedValue({ ok: false, status: 429, error: 'Too many requests' });
    render(withIntl(<ReviewForm titleId="f" />));
    fill();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(en.communityPage.reviews.form.errors.rateLimited);
    expect(screen.getByLabelText(en.pray.placeholderMessage)).toHaveValue('Thank you!');
    expect(revalidateReviews).not.toHaveBeenCalled();
  });

  it('explains a network failure', async () => {
    postJson.mockResolvedValue({ ok: false, status: 0, error: 'network' });
    render(withIntl(<ReviewForm titleId="f" />, 'he'));
    fireEvent.change(screen.getByLabelText(he.pray.placeholderFullName), { target: { value: 'מרים' } });
    fireEvent.change(screen.getByLabelText(he.pray.placeholderCountry), { target: { value: 'IL' } });
    fireEvent.change(screen.getByLabelText(he.pray.placeholderMessage), { target: { value: 'תודה רבה' } });
    fireEvent.click(screen.getByRole('button', { name: he.pray.submitButton }));
    expect(await screen.findByRole('alert')).toHaveTextContent(he.communityPage.reviews.form.errors.network);
  });
});
