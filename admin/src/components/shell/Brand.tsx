// The wordmark: a gold flame over a cross, in the same night + gold language as the public site.
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="22" stroke="var(--gold)" strokeWidth="1.5" opacity="0.55" />
      <path d="M24 8c4 4.500 6.500 8 6.500 11.500a6.500 6.500 0 0 1-13 0C17.500 16 20 12.500 24 8Z" fill="var(--gold)" />
      <path d="M24 28v12M18 33h12" stroke="var(--cream)" strokeWidth="2.200" strokeLinecap="round" />
    </svg>
  );
}
