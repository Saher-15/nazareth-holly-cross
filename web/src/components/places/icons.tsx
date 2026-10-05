import SvgIcon, { type IconProps } from '@/components/ui/SvgIcon';

// Small line icons of the holy sites pages. Decorative: the text next to them carries the meaning.

export const PinIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </SvgIcon>
);

export const RouteIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" />
  </SvgIcon>
);

export const PhotosIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M21 16l-5-5-8 8" />
  </SvgIcon>
);

export const ZoomIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.6-4.6M10.5 7.5v6M7.5 10.5h6" />
  </SvgIcon>
);

export const CloseIcon = (props: IconProps) => (
  <SvgIcon strokeWidth="2.2" {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </SvgIcon>
);

/** Points to the reading end (right in LTR); mirror it in RTL with CSS. */
export const ArrowIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </SvgIcon>
);

/** Chevron towards the reading end; mirror it in RTL with CSS. */
export const ChevronIcon = (props: IconProps) => (
  <SvgIcon strokeWidth="2.2" {...props}>
    <path d="M9 5l7 7-7 7" />
  </SvgIcon>
);

export const ChurchIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M12 2v4M10 4h4M6 21V11l6-4 6 4v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4" />
  </SvgIcon>
);

export const GiftIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3.5 8 4.2C6 4.8 6.6 8 9 8M12 8s1.5-4.5 4-3.8C18 4.8 17.4 8 15 8" />
  </SvgIcon>
);

export const HandsHeartIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <path d="M12 9.5c-1-2.2-4.5-2-4.5.6 0 2 2.5 3.6 4.5 5.1 2-1.5 4.5-3.1 4.5-5.1 0-2.6-3.5-2.8-4.5-.6z" />
    <path d="M2 14l3.5 3.5c1 1 2.3 1.5 3.7 1.5H12M22 14l-3.5 3.5c-1 1-2.3 1.5-3.7 1.5H12" />
  </SvgIcon>
);

export const PlayIcon = (props: IconProps) => (
  <SvgIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" />
  </SvgIcon>
);
