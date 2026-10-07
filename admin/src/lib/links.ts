/**
 * The same-site address a plain click on a link inside this tab would open, or null (a new tab, a download, another
 * site, a modified click, an /api/ address). Used by the guards that must ask before the dashboard moves on: a form
 * with unsaved changes (components/ui/useUnsavedChanges.ts) and a live broadcast whose sign-in has ended
 * (components/live/LiveBroadcast.tsx).
 */
export function internalHref(event: MouseEvent, origin: string): string | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = event.target as Element | null;
  const anchor = (typeof target?.closest === 'function' ? target.closest('a[href]') : null) as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || url.pathname.startsWith('/api/')) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
