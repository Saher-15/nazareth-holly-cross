'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { postJson } from '@/lib/apiClient';
import { markLiked, unmarkLiked, useHasLiked } from '@/lib/likedPrayers';
import styles from './LikeButton.module.css';

type Props = { id: string; likes: number; name: string };

// "Amen" on a prayer. The count goes up at once (optimistic) and is corrected by the API's answer; if the API
// does not answer, the count and the button go back and the visitor is told. One Amen per prayer per browser.
export default function LikeButton({ id, likes, name }: Props) {
  const t = useTranslations('pilgrim.prayers');
  const liked = useHasLiked(id);
  const [serverLikes, setServerLikes] = useState(likes);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  // While the request is out the count already includes this Amen.
  const shown = pending && liked ? serverLikes + 1 : serverLikes;

  async function amen() {
    if (liked || pending) return;
    setFailed(false);
    setPending(true);
    markLiked(id);
    const result = await postJson(`/prayer/like/${encodeURIComponent(id)}`, {});
    setPending(false);
    if (!result.ok) {
      unmarkLiked(id);
      setFailed(true);
      return;
    }
    // The answer is the prayer with its new count; anything else (plain text) is simply not trusted.
    const confirmed =
      result.data && typeof result.data === 'object' && 'likes' in result.data ? result.data.likes : undefined;
    setServerLikes(typeof confirmed === 'number' ? confirmed : serverLikes + 1);
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        aria-pressed={liked}
        aria-label={t('amenLabel', { name })}
        disabled={liked || pending}
        onClick={amen}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M8 21v-8M16 21v-8M12 3c2 3 5 4 5 8a5 5 0 0 1-10 0c0-4 3-5 5-8z" />
        </svg>
        <span>{liked ? t('amenDone') : t('amen')}</span>
      </button>
      <span className={styles.count} aria-live="polite">
        {shown > 0 ? t('amenCount', { count: shown }) : t('amenFirst')}
      </span>
      {failed && (
        <span className={styles.error} role="alert">
          {t('amenFailed')}
        </span>
      )}
    </div>
  );
}
