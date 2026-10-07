import type { ReactNode, SVGProps } from 'react';

// The site's inline icon set: one stroke style (24px grid, 2px round line, currentColor), so every
// icon matches in weight and colour. Icons are decorative (aria-hidden): the text or aria-label next
// to them carries the meaning. Icons that point along the reading direction (arrows, chevrons)
// take `flip` and mirror themselves in Hebrew and Arabic.

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Edge length in px; defaults to 1.25em so the icon scales with the text around it. */
  size?: number;
  /** Mirror in right-to-left languages. Use for anything that points "forward" or "back". */
  flip?: boolean;
};

function Svg({ size, flip, className = '', style, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`ui-icon${flip ? ' ui-flip-rtl' : ''}${className ? ` ${className}` : ''}`}
      style={size ? { ['--icon-size' as string]: `${size}px`, ...style } : style}
      {...rest}
    >
      {children}
    </svg>
  );
}

const make = (paths: ReactNode) =>
  function Icon(props: IconProps) {
    return <Svg {...props}>{paths}</Svg>;
  };

// ---- navigation and direction ----
/** Points to the reading end (right in LTR). Pass `flip` to mirror it in RTL. */
export const ArrowEndIcon = make(<path d="M4 12h15M13 6l6 6-6 6" />);
/** Points to the reading start (left in LTR). Pass `flip` to mirror it in RTL. */
export const ArrowStartIcon = make(<path d="M20 12H5M11 6l-6 6 6 6" />);
export const ChevronEndIcon = make(<path d="m9 5 7 7-7 7" />);
export const ChevronStartIcon = make(<path d="m15 5-7 7 7 7" />);
export const ChevronDownIcon = make(<path d="m5 9 7 7 7-7" />);
export const ArrowUpIcon = make(<path d="M12 20V5M6 11l6-6 6 6" />);
export const CloseIcon = make(<path d="M6 6l12 12M18 6 6 18" />);
export const MenuIcon = make(<path d="M4 7h16M4 12h16M4 17h16" />);
export const ExternalIcon = make(<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />);

// ---- media and accessibility (media controls never mirror) ----
export const PauseIcon = make(<path d="M9 6v12M15 6v12" />);
export const PlayIcon = make(<path d="M8 5.5v13l10.5-6.5z" />);
/** The international accessibility sign (the United Nations figure): a person with open arms and open stance in a
 *  circle, the head drawn solid so it reads at 20px. Opens the accessibility settings (<A11yPanel>). */
export const AccessibilityIcon = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="6.6" r="1.7" fill="currentColor" stroke="none" />
    <path d="M6.2 9.4c1.9.6 3.8.9 5.8.9s3.9-.3 5.8-.9M12 10.3v3.8M12 14.1l-2.9 4.5M12 14.1l2.9 4.5" />
  </>,
);
/** A magnifying glass: opens the site search (it never mirrors). */
export const SearchIcon = make(
  <>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m15.5 15.5 4.6 4.6" />
  </>,
);

// ---- status ----
export const CheckIcon = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const InfoIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.6v.1" />
  </>,
);
export const AlertIcon = make(
  <>
    <path d="M12 3.5 2.8 19.5h18.4L12 3.5z" />
    <path d="M12 10v4.5M12 17.2v.1" />
  </>,
);

// ---- things ----
export const GlobeIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" />
  </>,
);
export const ShareIcon = make(
  <>
    <circle cx="18" cy="5.5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" />
  </>,
);
export const LinkIcon = make(
  <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
);
export const PrintIcon = make(
  <>
    <path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" />
    <rect x="7" y="14" width="10" height="6" rx="1" />
  </>,
);
export const MailIcon = make(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7.5 8 6 8-6" />
  </>,
);
export const PinIcon = make(
  <>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </>,
);
export const RouteIcon = make(
  <>
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" />
  </>,
);
export const FlameIcon = make(<path d="M12 3c.5 3-1.8 4.6-3.2 6.6A6.2 6.2 0 0 0 12 21a6 6 0 0 0 5-9.3c-1 1-1.9 1.3-2.6 1.1C14.8 9.9 13.7 5.4 12 3z" />);
/** A calendar page with a plus: "add to calendar". */
export const CalendarAddIcon = make(
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
  </>,
);

// ---- social (outline versions in the same stroke style) ----
export const InstagramIcon = make(
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="3.8" />
    <path d="M17.3 6.8v.1" />
  </>,
);
export const FacebookIcon = make(<path d="M14 21v-8h2.8l.5-3.4H14V7.5c0-1 .5-1.7 1.8-1.7h1.6V3a18 18 0 0 0-2.4-.2c-2.5 0-4.1 1.5-4.1 4.2v2.6H8v3.4h2.9v8" />);
export const YoutubeIcon = make(
  <>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="m10.2 9.3 4.6 2.7-4.6 2.7z" fill="currentColor" />
  </>,
);

/** The brand mark: a cross with a halo, drawn once so header, footer and loading screens match. */
export function CrossMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
    >
      <circle cx="16" cy="16" r="14.2" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
      <path d="M16 6v20M9.5 12.5h13" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}
