import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CandleVideos from '@/app/[locale]/candle/CandleVideos';
import { api, type CandleVideo } from '@/lib/api';
import en from '@/messages/en.json';
import he from '@/messages/he.json';

// The candle page's videos (GET /candle/videos, the dashboard's "Candle page videos").
const video: CandleVideo = {
  id: 'v1',
  title: 'Lighting the candles',
  durationSeconds: 42,
  thumbnailUrl: 'https://customer-abc123.cloudflarestream.com/uid1/thumbnails/thumbnail.jpg',
  playbackUrl: 'https://customer-abc123.cloudflarestream.com/uid1/iframe',
};
const json = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const show = (videos: CandleVideo[], locale: 'en' | 'he' = 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : he} timeZone="Asia/Jerusalem">
      <CandleVideos videos={videos} />
    </NextIntlClientProvider>,
  );

describe('candle page videos', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('reads the published videos from the API', async () => {
    vi.stubGlobal('fetch', vi.fn(json([video])));
    expect(await api.candleVideos()).toEqual([video]);
  });

  it('shows none when the API fails, and refuses a player that is not Cloudflare Stream', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('fetch failed'))));
    expect(await api.candleVideos()).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(json([{ ...video, playbackUrl: 'https://evil.example/iframe' }])));
    expect(await api.candleVideos()).toEqual([]);
  });

  it('renders nothing without videos (the page looks as before)', () => {
    const { container } = show([]);
    expect(container.innerHTML).toBe('');
  });

  it('a poster button per video; Cloudflare\'s player only after a press', () => {
    show([video]);
    expect(screen.getByRole('heading', { name: 'Videos' })).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play the video: Lighting the candles' }));
    const frame = document.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe(`${video.playbackUrl}?autoplay=true`);
    expect(frame?.getAttribute('title')).toBe('Video: Lighting the candles');
  });

  it('is translated (Hebrew)', () => {
    show([video], 'he');
    expect(screen.getByRole('heading', { name: 'סרטונים' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'הפעלת הסרטון: Lighting the candles' })).toBeTruthy();
  });
});
