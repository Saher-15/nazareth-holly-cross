'use client';

import { useTranslations } from 'next-intl';
import { openSiteSearch } from './events';

// A text button that opens the search palette (the header is not touched, so the footer carries it).
export default function SearchButton({ className }: { className?: string }) {
  const t = useTranslations('pilgrim.search');
  return (
    <button type="button" className={className} onClick={openSiteSearch} aria-haspopup="dialog">
      {t('open')}
    </button>
  );
}
