import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LikeButton from '@/components/pilgrim/LikeButton';
import en from '@/messages/en.json';

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({ postJson }));

const KEY = 'nhc.prayers.liked.v1';

afterEach(cleanup);
beforeEach(() => {
  postJson.mockReset();
  localStorage.clear();
});

const withIntl = (ui: ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);

describe('LikeButton (Amen on a prayer)', () => {
  it('counts at once, confirms with the API number and remembers the prayer in this browser', async () => {
    let resolve!: (value: unknown) => void;
    postJson.mockReturnValue(new Promise((r) => (resolve = r)));
    render(withIntl(<LikeButton id="p1" likes={2} name="Maria" />));
    expect(screen.getByText('2 people said Amen')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Say Amen to the prayer of Maria' });
    fireEvent.click(button);
    // optimistic: already 3 and pressed while the request is out
    await waitFor(() => expect(screen.getByText('3 people said Amen')).toBeInTheDocument());
    expect(button).toBeDisabled();
    expect(postJson).toHaveBeenCalledWith('/prayer/like/p1', {});

    resolve({ ok: true, data: { likes: 7 } });
    await waitFor(() => expect(screen.getByText('7 people said Amen')).toBeInTheDocument());
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual(['p1']);
  });

  it('allows one Amen per prayer per browser, even after a reload', () => {
    localStorage.setItem(KEY, JSON.stringify(['p1']));
    render(withIntl(<LikeButton id="p1" likes={1} name="Maria" />));
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(postJson).not.toHaveBeenCalled();
  });

  it('goes back and says so when the API does not answer', async () => {
    postJson.mockResolvedValue({ ok: false, status: 0, error: 'network' });
    render(withIntl(<LikeButton id="p2" likes={0} name="Ana" />));
    expect(screen.getByText(en.pilgrim.prayers.amenFirst)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.pilgrim.prayers.amenFailed);
    expect(screen.getByText(en.pilgrim.prayers.amenFirst)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeEnabled();
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual([]);
  });
});
