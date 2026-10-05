import type { ReactNode } from 'react';

type Props = {
  href: string;
  className?: string;
  icon?: ReactNode;
  /** Read by screen readers after the label, e.g. "(opens in a new tab)". */
  newTabLabel: string;
  children: ReactNode;
};

// Link to another site (Google Maps), opened in a new tab and announced as such.
export default function ExternalLink({ href, className, icon, newTabLabel, children }: Props) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {icon}
      <span>{children}</span>
      <span className="visually-hidden"> {newTabLabel}</span>
    </a>
  );
}
