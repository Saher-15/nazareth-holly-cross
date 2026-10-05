// Finds candidate photos on Wikimedia Commons and lists only the ones whose licence the site may use.
//
//   node scripts/media/search.mjs "Mary's Well Nazareth" [--min 2400] [--category "Category:Well of St. Mary"]
//
// Prints: file name | size | licence | author | Commons page. It reads the licence of each file from the Commons API
// (the same check as build.mjs), so what is listed is a short list to LOOK AT, not a decision: still check the
// photo (sharp, well lit, no watermark, no brand, no identifiable person as subject) and add it to sources.json.
const UA = 'NazarethHolyCrossSiteBot/1.0 (https://nazarethholycross.com; saher@topazengs.net)';
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const query = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const category = flag('--category');
const minWidth = Number(flag('--min') ?? 2000);
if (!query && !category) {
  console.error('usage: node scripts/media/search.mjs "<words>" [--min 2400] [--category "Category:Name"]');
  process.exit(1);
}

const LICENSE_OK = /^(CC0( 1\.0)?|Public domain|PD[ -][\w.-]+|CC BY(-SA)? \d\.\d( \w+)?)$/i;
const strip = (s) => (s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const params = new URLSearchParams({
  action: 'query',
  format: 'json',
  origin: '*',
  prop: 'imageinfo',
  iiprop: 'url|extmetadata|size|mime',
  ...(category
    ? { generator: 'categorymembers', gcmtitle: category, gcmtype: 'file', gcmlimit: '50' }
    : { generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '50' }),
});
const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'User-Agent': UA } });
if (!res.ok) throw new Error(`Commons answered ${res.status}`);
const json = await res.json();
const rows = Object.values(json.query?.pages ?? {})
  .map((page) => {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    return info && {
      title: page.title.replace(/^File:/, ''),
      width: info.width,
      height: info.height,
      mime: info.mime,
      license: strip(meta.LicenseShortName?.value),
      artist: strip(meta.Artist?.value),
      nonFree: strip(meta.NonFree?.value),
      page: info.descriptionurl,
    };
  })
  .filter(Boolean);

const usable = rows.filter(
  (r) => r.mime === 'image/jpeg' && r.width >= minWidth && LICENSE_OK.test(r.license) && !r.nonFree && r.artist,
);
for (const r of usable) console.log([r.title, `${r.width}x${r.height}`, r.license, r.artist.slice(0, 40), r.page].join(' | '));
console.error(`${usable.length} of ${rows.length} results are usable (JPEG, at least ${minWidth}px wide, allowed licence, named author)`);
