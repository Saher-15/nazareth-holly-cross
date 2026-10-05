import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Lightbox from './Lightbox';
import '../../styles/Pages.css';

// First photo is a large feature tile, every sixth one from the fourth is a tall tile
// (not among the last few, so the grid ends evenly). Only one-column tiles span rows,
// so the grid never leaves holes in the middle.
const tileClass = (i, total) => {
  if (i === 0) return 'pg-tile pg-tile--feature';
  if (i % 6 === 3 && i < total - 4) return 'pg-tile pg-tile--tall';
  return 'pg-tile';
};

// Fade a thumbnail in (and stop its shimmer) once the file has arrived, also from the cache.
const markThumb = (img) => {
  if (img && img.parentElement) img.parentElement.classList.add('is-loaded');
};
const showWhenLoaded = (img) => {
  if (img && img.complete && img.naturalWidth > 0) markThumb(img);
};
const onThumbLoad = (e) => markThumb(e.currentTarget);

// Photo grid of one place + its lightbox.
function PlaceGallery({ images, name }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(null);
  const opener = useRef(null);
  const total = images.length;

  const getAlt = useCallback(
    (i) => t('places.photoAlt', { place: name, n: i + 1, total }),
    [t, name, total]
  );
  const close = useCallback(() => setIndex(null), []);

  const open = (i, e) => {
    opener.current = e.currentTarget;
    setIndex(i);
  };

  return (
    <>
      <ul className="pg-grid">
        {images.map((src, i) => (
          <li key={src} className={tileClass(i, total)}>
            <button type="button" className="pg-thumb" onClick={(e) => open(i, e)}>
              <img
                ref={showWhenLoaded}
                src={src}
                alt={getAlt(i)}
                loading={i < 3 ? 'eager' : 'lazy'}
                decoding="async"
                onLoad={onThumbLoad}
                onError={onThumbLoad}
              />
              <span className="pg-thumb__zoom" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
                  <path
                    d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.6-4.6M10.5 7.5v6M7.5 10.5h6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {index !== null && (
        <Lightbox
          images={images}
          index={index}
          onIndex={setIndex}
          onClose={close}
          getAlt={getAlt}
          title={name}
          label={t('places.viewer', { place: name })}
          labels={{ close: t('places.close'), prev: t('home.prev'), next: t('home.next') }}
          returnFocus={opener.current}
        />
      )}
    </>
  );
}

export default PlaceGallery;
