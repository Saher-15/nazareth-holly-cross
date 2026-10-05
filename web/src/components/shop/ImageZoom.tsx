'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';
import ShopIcon from './ShopIcon';
import styles from './ImageZoom.module.css';

// Twice the frame (min(92vw, 760px)), so the photo stays sharp under the 2.2x magnifier.
// It is only requested once the dialog opens.
const ZOOM_SIZES = 'min(200vw, 1520px)';

type Props = {
  open: boolean;
  src: string;
  alt: string;
  closeLabel: string;
  hint: string;
  onClose: () => void;
};

// Full-screen photo in a native modal <dialog>: the browser traps focus, closes it on
// Escape and gives focus back to the button that opened it. Moving the pointer over
// the photo magnifies the spot under it (2x); without a pointer the whole photo shows.
export default function ImageZoom({ open, src, alt, closeLabel, hint, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => dialogRef.current?.close();

  const magnify = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    });
  };

  return (
    // A click on the dimmed area around the photo (the dialog itself) closes it;
    // keyboard users have Escape and the close button.
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={alt}
      onClose={() => {
        setOrigin(null);
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <button type="button" className={styles.close} onClick={close} aria-label={closeLabel}>
        <ShopIcon name="close" />
      </button>
      {open && (
        <div
          className={styles.frame}
          data-zoomed={origin !== null}
          onPointerMove={magnify}
          onPointerLeave={() => setOrigin(null)}
          onPointerCancel={() => setOrigin(null)}
        >
          <Image
            className={styles.img}
            src={src}
            alt={alt}
            fill
            sizes={ZOOM_SIZES}
            style={origin ? { transformOrigin: `${origin.x}% ${origin.y}%` } : undefined}
          />
        </div>
      )}
      <p className={styles.hint}>{hint}</p>
    </dialog>
  );
}
