import SvgIcon from '@/components/ui/SvgIcon';

// Small inline icons of the home page (decorative, drawn on the shared 24x24 frame).

type IconProps = { className?: string };

/** Points towards the end of the line (right in LTR); mirror it with CSS in RTL. */
export function ChevronEnd({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m9 5 7 7-7 7" />
    </SvgIcon>
  );
}

export function ChevronStart({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m15 5-7 7 7 7" />
    </SvgIcon>
  );
}

export function ChevronDown({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m5 9 7 7 7-7" />
    </SvgIcon>
  );
}

export function ArrowEnd({ className }: IconProps) {
  return (
    <SvgIcon size={16} className={className}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </SvgIcon>
  );
}

export function SoundOn({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </SvgIcon>
  );
}

export function SoundOff({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="m17 9 5 6M22 9l-5 6" />
    </SvgIcon>
  );
}
