import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyse, flatten, loadEnglish } from './helpers/i18nUsage';

const english = loadEnglish();
const allKeys = flatten(english);
const { missing, used } = analyse(english);

// Messages carried over from the old (CRA) site that nothing reads any more. Delete a key from every
// language file, then from this list; the test below fails when an entry is stale.
// (The shop's namespaces - cart, shop, shopPage, product, pagination - are the shop's own business and
// are not checked here.)
const LEGACY_UNUSED = [
  'site.tagline',
  'live.refresh_note',
  'common.home',
  'common.live',
  'common.tour',
  'common.candle',
  'common.shop',
  'common.reviews',
  'heroSection.heading',
  'heroSection.subHeading',
  'heroSection.shopIcon',
  'heroSection.tourIcon',
  'cards.title',
  'cards.latinChurch',
  'cards.greekChurch',
  'cards.marysWell',
  'cards.oldCity',
  'cards.cityOfNazareth',
  'footer.aboutUs',
  'footer.aboutUsDescription',
  'footer.learnMore',
  'footer.contactUs',
  'footer.email',
  'footer.followInstagram',
  'footer.followFacebook',
  'footer.subscribeYoutube',
  'footer.credits',
  'footer.creditLink1',
  'footer.creditLink2',
  'footer.copyright',
  'site.footer.rights', // replaced by ux.footer.rights (the footer now writes the year itself)
  'paypalComponent.orderCancelled',
  'paypalComponent.thankYou',
  'paypalComponent.cost',
  'navbar.home',
  'navbar.live',
  'navbar.tour',
  'navbar.candle',
  'navbar.shop',
  'navbar.reviews',
  'mapButton',
  'confirmDetails',
  'confirmed',
  'orderCancelled',
];

const SHOP_NAMESPACES = ['cart', 'shop', 'shopPage', 'product', 'pagination'];
// Only the namespaces that existed when this check was written are enforced; a namespace added later
// (a new feature) is exempt until it is listed here.
const CHECKED_NAMESPACES = [
  'site', 'about', 'whatIsNew', 'live', 'common', 'candle', 'heroSection', 'cards', 'videos', 'nazarethTour', 'pray',
  'confirmationCandle', 'thankYou', 'footer', 'headerGreek', 'contentGreek', 'headerLatin', 'contentLatin',
  'headerMary', 'contentMary', 'headerTitleNaz', 'mapButton', 'contentNaz', 'headerTitleOld', 'mapDescriptionOld',
  'churchDescriptionOld', 'waterSourceOld', 'orderSummary', 'firstName', 'lastName', 'email', 'prayerAt', 'cost',
  'confirmDetails', 'confirmed', 'orderCancelled', 'paypalComponent', 'navbar', 'home', 'homePage', 'placesPage',
  'communityPage', 'checkoutPage',
];
const namespaceOf = (key: string) => key.split('.')[0];

describe('message keys used by the code', () => {
  it('exist in the message files (a typo would show the raw key to visitors)', () => {
    expect(missing.map((m) => `${m.file.split('src')[1]}: ${m.key}`)).toEqual([]);
  });

  it('are all still needed: no new message is added without something showing it', () => {
    const unused = allKeys.filter(
      (key) =>
        !used.has(key) &&
        CHECKED_NAMESPACES.includes(namespaceOf(key)) &&
        !SHOP_NAMESPACES.includes(namespaceOf(key)) &&
        !LEGACY_UNUSED.includes(key),
    );
    expect(unused).toEqual([]);
  });

  it('keep the legacy list honest: every entry still exists and is still unused', () => {
    expect(LEGACY_UNUSED.filter((key) => !allKeys.includes(key) || used.has(key))).toEqual([]);
  });
});

describe('the usage analysis itself', () => {
  const run = (source: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'i18n-usage-'));
    const file = join(dir, 'probe.tsx');
    writeFileSync(file, source);
    try {
      return analyse({ home: { title: 'T', shopAll: 'S', v1: 'a', v2: 'b' }, site: { name: 'N' } }, [file]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('resolves a key against the namespace the file translates in', () => {
    const { missing: gone, used: seen } = run(`const t = useTranslations('home');\nconst x = t('title');`);
    expect(gone).toEqual([]);
    expect([...seen]).toEqual(['home.title']);
  });

  it('reports a key that does not exist', () => {
    expect(run(`const t = useTranslations('home');\nt('titel');`).missing).toMatchObject([{ key: 'titel' }]);
  });

  it('follows translators bound in a Promise.all array and curried calls', () => {
    const { missing: gone, used: seen } = run(
      `const [t, tSite] = await Promise.all([getTranslations('home'), getTranslations('site'), load()]);\nt('shopAll'); tSite('name');`,
    );
    expect(gone).toEqual([]);
    expect([...seen].sort()).toEqual(['home.shopAll', 'site.name']);
  });

  it('counts template keys as using everything under their fixed start', () => {
    const { used: seen } = run("const t = useTranslations('home');\nt(`v${n}`);");
    expect([...seen].sort()).toEqual(['home.v1', 'home.v2']);
  });
});
