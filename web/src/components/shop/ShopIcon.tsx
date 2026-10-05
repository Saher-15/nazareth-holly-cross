import styles from './ShopIcon.module.css';

// Small stroke icons for the shop (inline SVG: no icon font, no extra request).
// Decorative only: the control next to them always carries the text or aria-label.
const paths = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.5-4.5" />
    </>
  ),
  cart: (
    <>
      <path d="M2.5 3.5h2.2l2.5 11.3a1.2 1.2 0 0 0 1.2.9h9.3a1.2 1.2 0 0 0 1.2-.9l1.8-7.3H6.1" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </>
  ),
  reset: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 3.5v5h5" />
    </>
  ),
  arrowNext: (
    <>
      <path d="M4.5 12h15" />
      <path d="m13.5 6 6 6-6 6" />
    </>
  ),
  arrowBack: (
    <>
      <path d="M19.5 12h-15" />
      <path d="m10.5 6-6 6 6 6" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="m6.2 7 .9 12.2A1.9 1.9 0 0 0 9 21h6a1.9 1.9 0 0 0 1.9-1.8L17.8 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  truck: (
    <>
      <path d="M2.5 6.5h11v9.5h-11z" />
      <path d="M13.5 10h4l3.5 3.5V16h-7.5" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  zoom: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.5-4.5M11 8v6M8 11h6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 10v4.5M12 17.4v.1" />
    </>
  ),
  basket: (
    <>
      <path d="M5 9h14l-1.3 10.2a1.8 1.8 0 0 1-1.8 1.6H8.1a1.8 1.8 0 0 1-1.8-1.6z" />
      <path d="M8.5 9 11 3.5M15.5 9 13 3.5" />
    </>
  ),
  box: (
    <>
      <path d="m3.5 7.5 8.5-4 8.5 4v9l-8.5 4-8.5-4z" />
      <path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9" />
    </>
  ),
  // The heart's path is filled by CSS (`fill: currentColor`) when the product is saved.
  heart: (
    <path d="M12 20.3s-7.6-4.5-9.3-9.3C1.5 7.5 3.8 4.5 7.1 4.5c2 0 3.7 1.1 4.9 2.9 1.2-1.8 2.9-2.9 4.9-2.9 3.3 0 5.6 3 4.4 6.5-1.7 4.8-9.3 9.3-9.3 9.3z" />
  ),
  share: (
    <>
      <path d="M12 14.5v-11M7.5 7.5 12 3l4.5 4.5" />
      <path d="M5 11.5v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </>
  ),
  filter: (
    <>
      <path d="M3.5 6.5h9M16.5 6.5h4M3.5 17.5h4M11.5 17.5h9" />
      <circle cx="14.5" cy="6.5" r="2" />
      <circle cx="9.5" cy="17.5" r="2" />
    </>
  ),
  chevronStart: <path d="m14.5 6-6 6 6 6" />,
  chevronEnd: <path d="m9.5 6 6 6-6 6" />,
  pen: (
    <>
      <path d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20z" />
      <path d="m14.5 8 1.5 1.5" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

// Arrows point the reading direction, so they mirror in Hebrew and Arabic.
const mirrored: readonly IconName[] = ['arrowNext', 'arrowBack', 'chevronStart', 'chevronEnd'];

export default function ShopIcon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`${styles.icon} ${mirrored.includes(name) ? styles.mirror : ''} ${className}`}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
