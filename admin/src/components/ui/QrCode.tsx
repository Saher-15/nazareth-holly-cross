import { useMemo } from 'react';
import { encodeQr, qrPath } from '@/lib/qr';

// A QR code drawn as one SVG path (light background so authenticator apps can read it on the dark theme).
export function QrCode({ value, label }: { value: string; label: string }) {
  const shape = useMemo(() => {
    try {
      return qrPath(encodeQr(value));
    } catch {
      return null;
    }
  }, [value]);
  if (!shape) return null;
  return (
    <svg className="qr" viewBox={`0 0 ${shape.size} ${shape.size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={shape.size} height={shape.size} className="qr__bg" />
      <path d={shape.d} className="qr__fg" />
    </svg>
  );
}
