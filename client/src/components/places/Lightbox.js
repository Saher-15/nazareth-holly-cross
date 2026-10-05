import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const SWIPE_MIN = 50; // px a finger must travel sideways to change photo

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CLOSE = 'M6 6l12 12M18 6L6 18';
const PREV = 'M15 5l-7 7 7 7';
const NEXT = 'M9 5l7 7-7 7';

// Full-screen photo viewer (a modal dialog rendered into <body>).
// Esc closes, Left/Right change photo, a sideways swipe changes photo,
// a click outside the controls closes, Tab stays inside the dialog,
// and focus goes back to `returnFocus` when it closes.
function Lightbox({ images, index, onIndex, onClose, getAlt, title, label, labels, returnFocus }) {
  const total = images.length;
  const src = images[index];
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const openerRef = useRef(returnFocus);
  const touch = useRef(null);
  const [loadedSrc, setLoadedSrc] = useState(null);

  const go = useCallback((dir) => onIndex((i) => (i + dir + total) % total), [onIndex, total]);

  // Open: lock the page scroll, hide the page behind from keyboard and screen readers,
  // move focus in. Close: undo all of it and return focus to the photo that opened it.
  useEffect(() => {
    const root = document.getElementById('root');
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const opener = openerRef.current;
    body.style.overflow = 'hidden';
    if (root) {
      root.setAttribute('inert', '');
      root.setAttribute('aria-hidden', 'true');
    }
    if (closeRef.current) closeRef.current.focus();
    return () => {
      body.style.overflow = prevOverflow;
      if (root) {
        root.removeAttribute('inert');
        root.removeAttribute('aria-hidden');
      }
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Tab' && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll('button:not([disabled])'));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!dialogRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Warm the cache for the neighbours so next/previous feel instant.
  useEffect(() => {
    if (total < 2) return;
    [index + 1, index - 1].forEach((i) => {
      const img = new Image();
      img.src = images[(i + total) % total];
    });
  }, [index, images, total]);

  const onTouchStart = (e) => {
    touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchMove = (e) => {
    if (e.touches.length > 1) touch.current = null; // a pinch is not a swipe
  };
  const onTouchEnd = (e) => {
    const start = touch.current;
    touch.current = null;
    if (!start || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  // Any click that is not on a control closes the viewer.
  const onClick = (e) => {
    if (!e.target.closest('button')) onClose();
  };

  const markLoaded = (img) => {
    if (img && img.complete && img.naturalWidth > 0) setLoadedSrc(img.getAttribute('src'));
  };
  const isLoaded = loadedSrc === src;

  return createPortal(
    <div
      className="plb"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      ref={dialogRef}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="plb__bar">
        <p className="plb__title" aria-hidden="true">
          {title}
          <span className="plb__count">
            {index + 1} / {total}
          </span>
        </p>
        <button ref={closeRef} type="button" className="plb__btn" onClick={onClose} aria-label={labels.close}>
          <Icon d={CLOSE} />
        </button>
      </div>

      <div className="plb__stage">
        {!isLoaded && <span className="plb__spinner" aria-hidden="true" />}
        <img
          key={src}
          ref={markLoaded}
          className={`plb__img${isLoaded ? ' is-loaded' : ''}`}
          src={src}
          alt={getAlt(index)}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setLoadedSrc(src)}
        />
      </div>

      <p className="plb__live" aria-live="polite">
        {getAlt(index)}
      </p>

      {total > 1 && (
        <div className="plb__nav">
          <button type="button" className="plb__btn plb__btn--nav" onClick={() => go(-1)} aria-label={labels.prev}>
            <Icon d={PREV} />
          </button>
          <button type="button" className="plb__btn plb__btn--nav" onClick={() => go(1)} aria-label={labels.next}>
            <Icon d={NEXT} />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

export default Lightbox;
