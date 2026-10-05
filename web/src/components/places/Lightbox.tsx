'use client';

import Image, { getImageProps } from 'next/image';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject, type TouchEvent } from 'react';
import type { Photo } from '@/data/places/places';
import { keyStep, stepIndex, swipeStep } from './galleryLogic';
import { ChevronIcon, CloseIcon } from './icons';
import styles from './Lightbox.module.css';

const SIZES = '100vw';

type Props = {
  photos: readonly Photo[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Shown in the top bar (the place name). */
  title: string;
  /** Accessible name of the dialog. */
  label: string;
  altOf: (index: number) => string;
  labels: { close: string; prev: string; next: string };
  rtl: boolean;
  /** Gets the focus back when the viewer closes (the photo that opened it). */
  returnFocus: RefObject<HTMLElement | null>;
};

// Full-screen photo viewer: a native modal <dialog>, so the page behind is inert for keyboard
// and screen readers. Esc closes, arrow keys and sideways swipes change photo (mirrored in RTL),
// Tab cycles through the controls, a click outside the controls closes, and the focus returns
// to the photo that opened it.
export default function Lightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  title,
  label,
  altOf,
  labels,
  rtl,
  returnFocus,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const total = photos.length;
  const photo = photos[index];
  const go = useCallback((delta: number) => onIndexChange(stepIndex(index, delta, total)), [index, total, onIndexChange]);

  // Open as a modal and lock the page scroll; on close undo both and give the focus back.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const returnTo = returnFocus.current;
    root.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      root.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      returnTo?.focus();
    };
  }, [returnFocus]);

  // Arrow keys change photo; Tab and Shift+Tab stay on the viewer's buttons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = total > 1 ? keyStep(e.key, rtl) : 0;
      if (step) {
        e.preventDefault();
        go(step);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      const dialog = dialogRef.current;
      if (e.key !== 'Tab' || !dialog) return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active) || (e.shiftKey && active === first) || (!e.shiftKey && active === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, onClose, rtl, total]);

  // Warm the cache with the neighbours (the same responsive file the viewer will ask for).
  useEffect(() => {
    if (total < 2) return;
    for (const delta of [1, -1]) {
      const next = photos[stepIndex(index, delta, total)];
      const { props } = getImageProps({ src: next.src, width: next.width, height: next.height, alt: '', sizes: SIZES });
      const img = new window.Image();
      if (props.sizes) img.sizes = props.sizes;
      if (props.srcSet) img.srcset = props.srcSet;
      img.src = props.src;
    }
  }, [index, photos, total]);

  const onTouchStart = (e: TouchEvent) => {
    touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 1) touch.current = null; // a pinch is not a swipe
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || !e.changedTouches.length || total < 2) return;
    const step = swipeStep(e.changedTouches[0].clientX - start.x, e.changedTouches[0].clientY - start.y, rtl);
    if (step) go(step);
  };

  // Any click that is not on a control (the dimmed area, the photo) closes the viewer.
  const onClick = (e: MouseEvent) => {
    if (!(e.target as Element).closest('button')) onClose();
  };

  const isLoaded = loadedSrc === photo.src;

  return (
    // The keyboard is handled on the document above; the click only adds a pointer shortcut to "Close".
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className={styles.bar}>
        <p className={styles.title} aria-hidden="true">
          <span className={styles.name}>{title}</span>
          <span className={styles.count} dir="ltr">
            {index + 1} / {total}
          </span>
        </p>
        <button ref={closeRef} type="button" className={styles.btn} onClick={onClose} aria-label={labels.close}>
          <CloseIcon size={24} />
        </button>
      </div>

      <div className={styles.stage}>
        {!isLoaded && <span className={styles.spinner} aria-hidden="true" />}
        <Image
          key={photo.src}
          className={`${styles.img} ${isLoaded ? styles.loaded : ''}`}
          src={photo.src}
          width={photo.width}
          height={photo.height}
          sizes={SIZES}
          alt={altOf(index)}
          loading="eager"
          draggable={false}
          onLoad={() => setLoadedSrc(photo.src)}
          onError={() => setLoadedSrc(photo.src)}
        />
      </div>

      <p className="visually-hidden" aria-live="polite">
        {altOf(index)}
      </p>

      {total > 1 && (
        <div className={styles.nav}>
          <button type="button" className={`${styles.btn} ${styles.navBtn}`} onClick={() => go(-1)} aria-label={labels.prev}>
            <ChevronIcon size={24} className={styles.prevIcon} />
          </button>
          <button type="button" className={`${styles.btn} ${styles.navBtn}`} onClick={() => go(1)} aria-label={labels.next}>
            <ChevronIcon size={24} className={styles.nextIcon} />
          </button>
        </div>
      )}
    </dialog>
  );
}
