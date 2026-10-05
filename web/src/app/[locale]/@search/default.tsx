import SiteSearch from '@/components/search/SiteSearch';

// The "search" slot of the language layout: the command-palette search (Ctrl/Cmd + K, or the Search button in the
// footer) is mounted once for every page, outside the header. The slot has no page of its own, so this fallback
// renders on every route.
export default function SearchSlot() {
  return <SiteSearch />;
}
