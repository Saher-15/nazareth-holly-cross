import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { encodeQr, qrPath, type QrMatrix } from '@/lib/qr';

// The in-house QR encoder is checked against an independent decoder (jsQR, dev-only dependency).
function decode(matrix: QrMatrix, scale = 6, quiet = 4): string | null {
  const size = (matrix.length + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix.length; x += 1) {
      if (!matrix[y][x]) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(data, size, size)?.data ?? null;
}

describe('QR encoder', () => {
  const samples = [
    'A',
    'hello world',
    'otpauth://totp/Nazareth%20Holy%20Cross:owner?secret=JBSWY3DPEHPK3PXP&issuer=Nazareth%20Holy%20Cross&algorithm=SHA1&digits=6&period=30',
    `otpauth://totp/Nazareth%20Holy%20Cross:a-long-user-name.example?secret=${'ABCDEFGH'.repeat(4)}&issuer=Nazareth%20Holy%20Cross`,
    'x'.repeat(100),
    'y'.repeat(150),
    'z'.repeat(213), // the largest the encoder takes (version 10, level M)
    'שלום مرحبا ok',
  ];

  for (const text of samples) {
    it(`decodes back to the same text (${text.length} chars: ${text.slice(0, 24)}...)`, () => {
      expect(decode(encodeQr(text))).toBe(text);
    });
  }

  it('grows with the text and is deterministic', () => {
    expect(encodeQr('A')).toHaveLength(21);
    expect(encodeQr('x'.repeat(100)).length).toBeGreaterThan(21);
    expect(encodeQr('same')).toEqual(encodeQr('same'));
  });

  it('draws the three finder patterns', () => {
    const m = encodeQr('finder');
    const n = m.length;
    for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      expect(m[oy][ox]).toBe(true);
      expect(m[oy + 3][ox + 3]).toBe(true);
      expect(m[oy + 1][ox + 1]).toBe(false);
      expect(m[oy + 6][ox + 6]).toBe(true);
    }
  });

  it('refuses text that does not fit instead of drawing a broken code', () => {
    expect(() => encodeQr('x'.repeat(214))).toThrow(RangeError);
  });

  it('turns a matrix into one SVG path with a quiet zone', () => {
    const { d, size } = qrPath(encodeQr('A'));
    expect(size).toBe(21 + 8);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toMatch(/^[MhvzM\d\s.-]+$/);
  });
});
