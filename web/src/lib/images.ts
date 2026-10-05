import { remoteImageHosts } from './remoteImageHosts';

/**
 * True when `next/image` may resize `src`: an image of this site, or one from a host that
 * next.config.ts allows. Anything else must be shown unoptimised, because `next/image` throws while
 * rendering when it meets a host it was not told about (one odd product photo would break the page).
 */
export function isOptimizable(src: string): boolean {
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  try {
    return remoteImageHosts.includes(new URL(src).hostname);
  } catch {
    return false;
  }
}
