import SvgIcon from './SvgIcon';

// Small icons used across the site's pages (drawn on the shared 24x24 frame).

type IconProps = { size?: number; className?: string };

export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <SvgIcon size={size} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </SvgIcon>
  );
}

export function AlertIcon({ size = 18, className }: IconProps) {
  return (
    <SvgIcon size={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </SvgIcon>
  );
}
