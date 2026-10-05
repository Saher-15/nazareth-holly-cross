import SvgIcon from '@/components/ui/SvgIcon';

// Small decorative icons for the payment flows (drawn on the shared 24x24 frame). The check and alert
// icons shared with other pages live in components/ui/icons.

type IconProps = { size?: number; className?: string };

export function HeartIcon({ size = 28, className }: IconProps) {
  return (
    <SvgIcon size={size} className={className}>
      <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" />
    </SvgIcon>
  );
}

export function LockIcon({ size = 16, className }: IconProps) {
  return (
    <SvgIcon size={size} className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </SvgIcon>
  );
}

export function BasketIcon({ size = 28, className }: IconProps) {
  return (
    <SvgIcon size={size} className={className}>
      <path d="M3 10h18l-2 9H5l-2-9z" />
      <path d="M8 10l4-6 4 6M9 14v2M12 14v2M15 14v2" />
    </SvgIcon>
  );
}
