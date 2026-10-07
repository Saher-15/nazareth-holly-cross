'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import { isLeavingForSignIn } from '@/lib/drafts';
import { internalHref } from '@/lib/links';
import { useFeedback } from './Feedback';

// "You have unsaved changes" (review 04 finding 8). While `dirty`:
//   - a link inside the dashboard (the menu, the brand, "View all", a Cancel that is a link) asks first, in the app's
//     own confirm dialog; staying keeps everything as typed;
//   - closing, reloading or leaving the site makes the browser ask (beforeunload), except when the page leaves for the
//     sign-in page because the session ended: the form's draft (lib/drafts.ts) brings the text back after the sign-in.
// `leave(href)` is for a button that navigates (Cancel): it asks the same question.

export function useUnsavedChanges(dirty: boolean) {
  const { t } = useI18n();
  const { confirm } = useFeedback();
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const ask = useCallback(
    () => confirm({ title: t('unsaved.title'), message: t('unsaved.text'), confirmLabel: t('unsaved.leave'), tone: 'danger' }),
    [confirm, t],
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current && !isLeavingForSignIn()) event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current) return;
      const href = internalHref(event, window.location.origin);
      if (!href || href === `${window.location.pathname}${window.location.search}`) return;
      event.preventDefault();
      event.stopPropagation();
      void ask().then((ok) => {
        if (!ok) return;
        dirtyRef.current = false;
        router.push(href);
      });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, ask, router]);

  /** Goes to `href`, asking first when there are unsaved changes. Resolves false when the admin stays. */
  const leave = useCallback(
    async (href: string) => {
      if (dirtyRef.current && !(await ask())) return false;
      dirtyRef.current = false;
      router.push(href);
      return true;
    },
    [ask, router],
  );

  /** The changes were saved (or deliberately dropped): navigating away no longer asks. */
  const release = useCallback(() => {
    dirtyRef.current = false;
  }, []);

  return { leave, release };
}
