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

// ---- the "Today in Nazareth" strip ----

export function ClockIcon({ className }: IconProps) {
  return (
    <SvgIcon size={18} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </SvgIcon>
  );
}

/** The sun on the horizon (sunrise and sunset). */
export function SunIcon({ className }: IconProps) {
  return (
    <SvgIcon size={18} className={className}>
      <path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 6.5V9M5.6 10.6l1.6 1.6M18.4 10.6l-1.6 1.6" />
    </SvgIcon>
  );
}

/** A plain cross (the feast of the day). */
export function CrossIcon({ className }: IconProps) {
  return (
    <SvgIcon size={18} className={className}>
      <path d="M12 3.5v17M7 8.5h10" />
    </SvgIcon>
  );
}

/** A broadcast: a dot with waves on both sides. */
export function BroadcastIcon({ className }: IconProps) {
  return (
    <SvgIcon size={18} className={className}>
      <circle cx="12" cy="12" r="1.8" />
      <path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
    </SvgIcon>
  );
}
