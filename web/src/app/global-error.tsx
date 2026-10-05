/* eslint-disable no-restricted-syntax -- global-error replaces the whole document, outside the intl provider, so it cannot use translations */
'use client';

// Only shown when the page shell itself (the language layout) fails, so it brings its own <html> and
// cannot use the site's translations or styles: plain, readable, with the brand colours.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0a0e1a',
          color: '#f7efdc',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <main>
          <h1 style={{ fontWeight: 400, fontSize: '2rem' }}>Something went wrong on our side.</h1>
          <p style={{ color: '#b9bfd3' }}>Please try again in a moment.</p>
          {error.digest && <p style={{ color: '#b9bfd3', fontSize: '0.8rem' }}>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              padding: '12px 28px',
              borderRadius: 999,
              border: 0,
              background: '#f0c04a',
              color: '#1a1405',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
