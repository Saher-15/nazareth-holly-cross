'use client';

import { useEffect, useSyncExternalStore } from 'react';

// Last resort: this replaces the whole page, including the layout, when even the layout fails (so there is
// no translation provider, no fonts and no stylesheet to lean on). It therefore carries its own short
// texts in all fourteen languages and picks one from the language in the address (/he/...).
const TEXTS: Record<string, { title: string; text: string; retry: string }> = {
  en: { title: 'Something went wrong', text: 'An unexpected error stopped this page. Please try again.', retry: 'Try again' },
  fr: { title: 'Une erreur est survenue', text: 'Une erreur inattendue a interrompu cette page. Veuillez réessayer.', retry: 'Réessayer' },
  es: { title: 'Algo salió mal', text: 'Un error inesperado detuvo esta página. Inténtalo de nuevo.', retry: 'Intentar de nuevo' },
  de: { title: 'Etwas ist schiefgelaufen', text: 'Ein unerwarteter Fehler hat diese Seite gestoppt. Bitte versuchen Sie es erneut.', retry: 'Erneut versuchen' },
  it: { title: 'Qualcosa è andato storto', text: 'Un errore imprevisto ha interrotto questa pagina. Riprova.', retry: 'Riprova' },
  pt: { title: 'Algo correu mal', text: 'Um erro inesperado interrompeu esta página. Tente novamente.', retry: 'Tentar novamente' },
  pl: { title: 'Coś poszło nie tak', text: 'Nieoczekiwany błąd zatrzymał tę stronę. Spróbuj ponownie.', retry: 'Spróbuj ponownie' },
  ru: { title: 'Что-то пошло не так', text: 'Неожиданная ошибка остановила загрузку страницы. Пожалуйста, попробуйте ещё раз.', retry: 'Повторить' },
  uk: { title: 'Щось пішло не так', text: 'Неочікувана помилка зупинила завантаження сторінки. Будь ласка, спробуйте ще раз.', retry: 'Спробувати ще раз' },
  ro: { title: 'Ceva nu a mers bine', text: 'O eroare neașteptată a oprit această pagină. Vă rugăm să încercați din nou.', retry: 'Încercați din nou' },
  nl: { title: 'Er ging iets mis', text: 'Een onverwachte fout heeft deze pagina gestopt. Probeer het opnieuw.', retry: 'Opnieuw proberen' },
  el: { title: 'Κάτι πήγε στραβά', text: 'Ένα απρόβλεπτο σφάλμα διέκοψε αυτή τη σελίδα. Δοκιμάστε ξανά.', retry: 'Δοκιμάστε ξανά' },
  he: { title: 'משהו השתבש', text: 'שגיאה בלתי צפויה עצרה את הדף. נא לנסות שוב.', retry: 'נסו שוב' },
  ar: { title: 'حدث خطأ ما', text: 'أوقف خطأ غير متوقع تحميل هذه الصفحة. يرجى المحاولة مرة أخرى.', retry: 'حاول مرة أخرى' },
};

const RTL = new Set(['he', 'ar']);

function languageFromPath(): string {
  const first = window.location.pathname.split('/')[1] ?? '';
  return first in TEXTS ? first : 'en';
}

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // English on the server and during hydration; the visitor's language right after (no hydration mismatch).
  const lang = useSyncExternalStore(
    () => () => undefined,
    languageFromPath,
    () => 'en',
  );
  const text = TEXTS[lang];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={lang} dir={RTL.has(lang) ? 'rtl' : 'ltr'}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <title>{text.title}</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#0a0e1a',
          color: '#f7efdc',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
          textAlign: 'center',
        }}
      >
        <main style={{ maxWidth: 520 }}>
          <p aria-hidden="true" style={{ margin: 0, fontSize: 48, color: '#f0c04a' }}>
            ✝
          </p>
          <h1 style={{ margin: '12px 0', fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 'clamp(1.7rem, 6vw, 2.4rem)' }}>
            {text.title}
          </h1>
          <p style={{ margin: '0 0 24px', color: '#b9bfd3', lineHeight: 1.6 }}>{text.text}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: '10px 28px',
              border: 0,
              borderRadius: 999,
              background: '#f0c04a',
              color: '#1a1405',
              font: '700 1rem system-ui, sans-serif',
              cursor: 'pointer',
            }}
          >
            {text.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
