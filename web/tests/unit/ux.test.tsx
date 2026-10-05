import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BackToTop from '@/components/layout/BackToTop';
import { nextOptionIndex } from '@/components/layout/LanguageSwitcher';
import { isPageLinkClick } from '@/components/layout/PageTransitions';
import { isLongPage, readingFraction } from '@/components/layout/ReadingProgress';
import { CheckIcon, ArrowEndIcon } from '@/components/ui/icons';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import messages from '@/messages/en.json';

// next-intl's navigation helpers need the Next.js runtime; these tests only need the pure parts.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  usePathname: () => '/',
  useRouter: () => ({ replace: () => undefined }),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({}) }));

const withIntl = (ui: ReactNode) => (
  <NextIntlClientProvider locale="en" messages={messages}>
    {ui}
  </NextIntlClientProvider>
);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('readingFraction', () => {
  it('is 0 at the top, 1 at the bottom and clamped in between', () => {
    expect(readingFraction(0, 3000, 1000)).toBe(0);
    expect(readingFraction(1000, 3000, 1000)).toBe(0.5);
    expect(readingFraction(2000, 3000, 1000)).toBe(1);
    expect(readingFraction(2600, 3000, 1000)).toBe(1);
    expect(readingFraction(-40, 3000, 1000)).toBe(0);
  });
  it('is 0 for a page that fits the window', () => {
    expect(readingFraction(0, 800, 1000)).toBe(0);
  });
});

describe('isLongPage', () => {
  it('matches the holy-site pages, the tour and the about page only', () => {
    for (const path of ['/sites/latin', '/sites/maryswell', '/tour', '/about']) expect(isLongPage(path)).toBe(true);
    for (const path of ['/', '/sites', '/shop', '/shop/123', '/candle', '/live', '/sites/latin/extra']) {
      expect(isLongPage(path)).toBe(false);
    }
  });
});

describe('language menu arrow keys', () => {
  // The menu is a grid of two columns; in Hebrew and Arabic it is mirrored, so left and right swap.
  it('moves by column and row in left-to-right', () => {
    expect(nextOptionIndex(0, 'ArrowRight', 11, false)).toBe(1);
    expect(nextOptionIndex(1, 'ArrowLeft', 11, false)).toBe(0);
    expect(nextOptionIndex(0, 'ArrowDown', 11, false)).toBe(2);
    expect(nextOptionIndex(3, 'ArrowUp', 11, false)).toBe(1);
  });
  it('mirrors left and right in right-to-left', () => {
    expect(nextOptionIndex(1, 'ArrowRight', 11, true)).toBe(0);
    expect(nextOptionIndex(0, 'ArrowLeft', 11, true)).toBe(1);
  });
  it('stops at the edges and supports Home and End', () => {
    expect(nextOptionIndex(0, 'ArrowLeft', 11, false)).toBe(0);
    expect(nextOptionIndex(10, 'ArrowRight', 11, false)).toBe(10);
    expect(nextOptionIndex(10, 'ArrowDown', 11, false)).toBe(10);
    expect(nextOptionIndex(0, 'ArrowUp', 11, false)).toBe(0);
    expect(nextOptionIndex(4, 'Home', 11, false)).toBe(0);
    expect(nextOptionIndex(4, 'End', 11, false)).toBe(10);
    expect(nextOptionIndex(4, 'x', 11, false)).toBe(4);
  });
});

function Demo({ kind }: { kind?: 'error' | 'success' }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show({ message: 'Saved!', kind })}>
      go
    </button>
  );
}

describe('isPageLinkClick (which clicks start a page transition)', () => {
  // Next's <Link> has called preventDefault() by the time the document sees a client-side navigation.
  // The document listener decides first and then cancels the click, so jsdom never tries to navigate.
  const decide = (href: string, currentPath: string, init: MouseEventInit = {}, takenOver = true) => {
    const a = document.createElement('a');
    a.href = href;
    document.body.appendChild(a);
    let result = false;
    const onDocument = (e: MouseEvent) => {
      result = isPageLinkClick(e, currentPath);
      e.preventDefault();
    };
    a.addEventListener('click', (e) => {
      if (takenOver) e.preventDefault();
    });
    document.addEventListener('click', onDocument);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
    document.removeEventListener('click', onDocument);
    a.remove();
    return result;
  };

  it('accepts a taken-over click on an internal link to another page', () => {
    expect(decide('/en/tour', '/en')).toBe(true);
  });
  it('ignores the current page, hash jumps, other sites, new tabs and modified clicks', () => {
    expect(decide('/en', '/en')).toBe(false);
    expect(decide('/en#main', '/en')).toBe(false);
    expect(decide('https://example.org/x', '/en')).toBe(false);
    expect(decide('/en/tour', '/en', { ctrlKey: true })).toBe(false);
    expect(decide('/en/tour', '/en', { button: 1 })).toBe(false);
  });
  it('ignores a click nobody took over (an ordinary anchor)', () => {
    expect(decide('/en/tour', '/en', {}, false)).toBe(false);
  });
});

describe('toasts', () => {
  it('shows a message in a live region and removes it by itself', () => {
    vi.useFakeTimers();
    render(withIntl(<ToastProvider><Demo kind="success" /></ToastProvider>));
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    expect(document.querySelector('[aria-live="polite"]')).toContainElement(screen.getByText('Saved!'));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });

  it('announces errors as alerts and lets the visitor dismiss a toast', () => {
    render(withIntl(<ToastProvider><Demo kind="error" /></ToastProvider>));
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Saved!');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });

  it('is a silent no-op outside a provider', () => {
    render(<Demo />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'go' }))).not.toThrow();
  });

  it('keeps at most three toasts and does not repeat the same message', () => {
    function Many() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            for (const m of ['a', 'b', 'c', 'd', 'd']) toast.show({ message: m });
          }}
        >
          many
        </button>
      );
    }
    render(withIntl(<ToastProvider><Many /></ToastProvider>));
    fireEvent.click(screen.getByRole('button', { name: 'many' }));
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.getAllByText('d')).toHaveLength(1);
    expect(screen.getByText('b')).toBeInTheDocument();
  });
});

describe('BackToTop', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });

  it('appears after a long scroll and scrolls to the top, then focuses <main>', async () => {
    render(
      withIntl(
        <>
          <main id="main" tabIndex={-1} />
          <BackToTop />
        </>,
      ),
    );
    const button = screen.getByRole('button', { name: 'Back to top', hidden: true });
    expect(button).toHaveAttribute('data-shown', 'false');
    Object.defineProperty(window, 'scrollY', { value: 2000, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => expect(button).toHaveAttribute('data-shown', 'true'));
    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    expect(document.activeElement).toBe(document.getElementById('main'));
  });
});

describe('icons', () => {
  it('are decorative and mirror in right-to-left only when asked', () => {
    const { container } = render(
      <>
        <CheckIcon />
        <ArrowEndIcon flip />
      </>,
    );
    const [check, arrow] = Array.from(container.querySelectorAll('svg'));
    expect(check).toHaveAttribute('aria-hidden', 'true');
    expect(check).not.toHaveClass('ui-flip-rtl');
    expect(arrow).toHaveClass('ui-flip-rtl');
  });
});
