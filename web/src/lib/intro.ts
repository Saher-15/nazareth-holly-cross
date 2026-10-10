import { locales } from '@/i18n/routing';

// The opening of the site (components/home/OpeningDoor.tsx, docs/DESIGN-GUIDE.md "Home"): a door that opens on a
// strong light and a greeting, once when the visitor opens the site, never again while the tab stays open. A tiny
// script in the <head> (INTRO_PREPAINT, given the request's CSP nonce by app/[locale]/layout.tsx) decides before the
// first paint, so the door is there from the first frame or not at all (no flash of the page, then the door).
//
// It shows only when all of these hold:
// - the first page of this tab's visit is the home page (any page marks the visit as begun, so going back to the
//   home page later, or opening it from the menu, never shows it again);
// - the visitor has not asked for less motion (the system setting, or "Stop animations" in the accessibility panel:
//   INTRO_PREPAINT runs after A11Y_PREPAINT, which sets data-a11y-motion);
// - the browser is not driven by automation (tests and crawlers see the page itself; e2e/opening-door.spec.ts turns
//   the door on explicitly).
// Any key, click, tap or scroll skips it (data-intro="skip": a short fade), listened to by the same script so it works
// before the page hydrates; the same script removes the attribute when the overlay's fade ends, so the whole opening
// works without React. Nothing is sent anywhere; sessionStorage is this tab only and forgets the visit when the
// tab is closed.

export const INTRO_STORAGE_KEY = 'nhc.intro.v1';
export const INTRO_ATTRIBUTE = 'data-intro';
export const INTRO_VALUE = 'door';
/** Marks the overlay: its own fade ending (natural or skipped) ends the opening. */
export const INTRO_OVERLAY_ATTRIBUTE = 'data-intro-overlay';
/** The CSS ends it at about 3.6 s; this only frees the page if an animation never ends. */
const INTRO_FALLBACK_MS = 6000;

const HOME_PATH = `^/(?:${locales.join('|')})/?$`;

export const INTRO_PREPAINT = `(function(){try{var s=sessionStorage,k=${JSON.stringify(INTRO_STORAGE_KEY)};if(s.getItem(k))return;s.setItem(k,'1');var d=document.documentElement;if(navigator.webdriver)return;if(!new RegExp(${JSON.stringify(HOME_PATH)}).test(location.pathname))return;if(d.getAttribute('data-a11y-motion')==='reduce'||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;d.setAttribute(${JSON.stringify(INTRO_ATTRIBUTE)},${JSON.stringify(INTRO_VALUE)});var A=${JSON.stringify(INTRO_ATTRIBUTE)},end=function(){d.removeAttribute(A)},skip=function(){if(d.getAttribute(A)===${JSON.stringify(INTRO_VALUE)})d.setAttribute(A,'skip')};['keydown','pointerdown','wheel','touchmove'].forEach(function(n){addEventListener(n,skip,{passive:true})});addEventListener('animationend',function(e){if(e.target&&e.target.hasAttribute&&e.target.hasAttribute(${JSON.stringify(INTRO_OVERLAY_ATTRIBUTE)}))end()},true);setTimeout(end,${INTRO_FALLBACK_MS})}catch(e){}})();`;

