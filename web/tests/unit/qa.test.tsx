import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LocaleError from '@/app/[locale]/error';
import { locales } from '@/i18n/routing';
import messages from '@/messages/en.json';

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en${href}`} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('QA-10 the page error boundary', () => {
  it('shows an apology, a way to try again and a way home, and reports the error', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = vi.fn();
    const error = Object.assign(new Error('boom'), { digest: 'abc' });
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LocaleError error={error} retry={retry} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong on our side');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en/');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(error);
  });

  it('only uses messages that exist in every language', async () => {
    for (const locale of locales) {
      const m = (await import(`@/messages/${locale}.json`)).default;
      expect(m.communityPage.reviews.form.errors.server, locale).toBeTruthy();
      expect(m.home.retry, locale).toBeTruthy();
      expect(m.site.notFound.backHome, locale).toBeTruthy();
    }
  });
});
