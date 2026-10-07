// The brand medallion: the Nazareth Holy Cross logo (public/images/logo.webp) cropped round and pre-sized by
// scripts/media/logo.mjs to 48, 96 and 144 px, in AVIF and WebP (about 1 to 5 kB each), so a phone with a sharp
// screen gets the 2x or 3x file and nothing is resized on the server. Decorative (alt=""): the brand name beside it
// names the link. `sizes` says how wide it is shown; width and height keep its place before it loads (no shift).
const WIDTHS = [48, 96, 144] as const;
const srcSet = (format: 'avif' | 'webp') => WIDTHS.map((w) => `/images/brand/logo-${w}.${format} ${w}w`).join(', ');

export default function BrandLogo({ className, sizes, size = 48 }: { className?: string; sizes: string; size?: number }) {
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={srcSet('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet('webp')} sizes={sizes} />
      {/* A plain <img> on purpose, as in MediaPicture: the files were generated ahead of time. */}
      <img
        src="/images/brand/logo-96.webp"
        srcSet={srcSet('webp')}
        sizes={sizes}
        alt=""
        width={size}
        height={size}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}
