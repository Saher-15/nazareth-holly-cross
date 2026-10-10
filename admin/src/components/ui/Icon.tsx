import type { SVGProps } from 'react';

// A small set of 24x24 stroke icons. They are decoration: the label is always text next to them (or an aria-label
// on the button that holds them), so the SVG itself is hidden from assistive technology.

const PATHS = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  orders: 'M6 7h12l1.2 13H4.8L6 7Zm3 0a3 3 0 0 1 6 0',
  candles: 'M12 3c1.6 2 2.4 3.3 2.4 4.6a2.4 2.4 0 1 1-4.8 0C9.6 6.3 10.4 5 12 3ZM8 12h8v9H8v-9Z',
  mail: 'M3 6h18v12H3V6Zm0 1 9 7 9-7',
  products: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 8.5L4.5 7.3M12 11.5l7.5-4.2M12 11.5V21',
  reviews: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  prayers: 'M12 21c-4-3-7-6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4-3 7-7 10Z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10a7 7 0 0 1 14 0M17 4.3a4 4 0 0 1 0 7.4M22 21a7 7 0 0 0-4-6.3',
  audit: 'M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Zm-3 9 2.2 2.2L15.5 10',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.6 1.6 1.2-2 3.5-1.9-.7a7.600 7.600 0 0 1-1.700 1l-.300 2h-4l-.300-2a7.600 7.600 0 0 1-1.700-1l-1.900.7-2-3.500 1.600-1.200a7.800 7.800 0 0 1 0-2l-1.600-1.200 2-3.500 1.900.7a7.600 7.600 0 0 1 1.700-1l.300-2h4l.300 2a7.600 7.600 0 0 1 1.700 1l1.900-.7 2 3.500-1.600 1.200a7.800 7.800 0 0 1 0 2Z',
  profile: 'M12 12a4.500 4.500 0 1 0 0-9 4.500 4.500 0 0 0 0 9Zm-8 9a8 8 0 0 1 16 0',
  logout: 'M9 21H5V3h4m6 5 5 4-5 4m5-4H9',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9a2.800 2.800 0 0 0-4-4L4 16v4Zm9-13 4 4',
  trash: 'M4 7h16M10 7V4h4v3m-8 0 1 13h10l1-13M10 11v6m4-6v6',
  check: 'm5 12.500 4.500 4.500L19 7.500',
  x: 'M6 6l12 12M18 6 6 18',
  download: 'M12 4v11m-5-4 5 5 5-5M5 20h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  eye: 'M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18M10.600 6.100A9.600 9.600 0 0 1 12 6c6.500 0 10 6 10 6a17 17 0 0 1-3.200 3.800M6.600 7.600A17 17 0 0 0 2 12s3.500 7 10 7a9.700 9.700 0 0 0 4.200-1M9.900 9.900a3 3 0 0 0 4.200 4.200',
  alert: 'M12 3 2 20h20L12 3Zm0 6v5m0 3v.010',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9v.010',
  chevronRight: 'm9 6 6 6-6 6',
  chevronLeft: 'm15 6-6 6 6 6',
  lock: 'M6 11h12v10H6V11Zm2 0V8a4 4 0 0 1 8 0v3',
  truck: 'M2 6h11v10H2V6Zm11 4h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  image: 'M4 5h16v14H4V5Zm0 11 4.500-4.500 4 4 3-3L20 17M9 10a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3Z',
  flame: 'M12 3c3 3 5 5.500 5 9a5 5 0 0 1-10 0c0-1.800.700-3 2-4.500.300 1.200 1 2 2 2.500C10.500 7.500 11 5.500 12 3Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
  copy: 'M9 9h11v11H9V9Zm-5 6V4h11',
  payments: 'M3 6h18v12H3V6Zm0 4h18M7 15h4',
  userX: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10a7 7 0 0 1 14 0M17 8l5 5m0-5-5 5',
  broadcast: 'M12 13.500a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3ZM7.800 7.800a6 6 0 0 0 0 8.400m8.400-8.400a6 6 0 0 1 0 8.400M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14',
  video: 'M3 7h12v10H3V7Zm12 4 6-3v8l-6-3',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3',
  micOff: 'M3 3l18 18M9 9v3a3 3 0 0 0 5.100 2.100M15 9.300V6a3 3 0 0 0-5.900-.700M5 12a7 7 0 0 0 11.900 5M19 12a7 7 0 0 1-.400 2.300M12 19v3',
  switchCamera: 'M4 8h3l2-2h6l2 2h3v11H4V8Zm4.500 5.500a3.500 3.500 0 0 1 6-2.500l.500.500m.500 1.500a3.500 3.500 0 0 1-6 2.500l-.500-.500M15 9.500v2h-2M9 17.500v-2h2',
  stop: 'M7 7h10v10H7V7Z',
  chart: 'M4 20V11m5.300 9V5m5.400 15v-7M20 20V8M2 20h20',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
