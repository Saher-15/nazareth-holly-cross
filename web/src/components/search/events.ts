/** Dispatched on `window` by any button that wants to open the site search palette. */
export const OPEN_SEARCH_EVENT = 'nhc:open-search';

export const openSiteSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
