'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { LinkIcon, PrintIcon, ShareIcon } from './icons';
import { useToast } from './Toast';

type Props = {
  /** Title offered to the share sheet (the page's name). */
  title: string;
  /** Hide the print button on pages that are not meant for paper. */
  print?: boolean;
};

/** Copies text with the Clipboard API, falling back to a hidden textarea on old or insecure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

// "Share" (the phone's share sheet where there is one, else copy the link and say so in a toast) and
// "Print" (the print styles turn the page into a clean article). Hidden when printing.
export default function PageTools({ title, print = true }: Props) {
  const t = useTranslations('ux.share');
  const toast = useToast();
  // False on the server and during hydration, then true where the browser has a share sheet.
  const canNativeShare = useSyncExternalStore(
    () => () => undefined,
    () => typeof navigator.share === 'function',
    () => false,
  );

  const share = async () => {
    const url = window.location.href;
    if (canNativeShare) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return; // the visitor closed the sheet
      }
    }
    const copied = await copyText(url);
    toast.show({ message: copied ? t('copied') : t('failed'), kind: copied ? 'success' : 'error' });
  };

  return (
    <div className="ui-tools" data-print="hide">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={share}>
        {canNativeShare ? <ShareIcon size={18} /> : <LinkIcon size={18} />}
        {canNativeShare ? t('share') : t('copy')}
      </button>
      {print && (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => window.print()}>
          <PrintIcon size={18} />
          {t('print')}
        </button>
      )}
    </div>
  );
}
