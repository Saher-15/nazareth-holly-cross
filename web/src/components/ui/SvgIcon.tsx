import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

// The 24x24 line-icon frame every icon set of the site draws in. Icons use currentColor and are always
// decorative (aria-hidden): the text next to them carries the meaning.
export default function SvgIcon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}
