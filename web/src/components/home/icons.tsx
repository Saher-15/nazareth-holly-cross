// Small inline icons (decorative: always aria-hidden). They draw with currentColor.

type IconProps = { className?: string };

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

/** Points towards the end of the line (right in LTR); mirror it with CSS in RTL. */
export function ChevronEnd({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ChevronStart({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

export function ChevronDown({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m5 9 7 7 7-7" />
    </svg>
  );
}

export function ArrowEnd({ className }: IconProps) {
  return (
    <svg {...base} width={16} height={16} className={className}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function SoundOn({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

export function SoundOff({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="m17 9 5 6M22 9l-5 6" />
    </svg>
  );
}
