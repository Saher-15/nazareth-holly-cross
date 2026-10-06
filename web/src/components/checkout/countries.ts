// Countries for the delivery address, named in the visitor's language by the browser
// (Intl.DisplayNames), so no country list has to be translated or shipped per language.

// ISO 3166-1 alpha-2 codes (the same 249 entries the current site offers).
export const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW ' +
  'BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ ' +
  'FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ ' +
  'IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH ' +
  'MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL ' +
  'PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD ' +
  'TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

export type CountryOption = { code: string; name: string };

function displayNames(locale: string) {
  try {
    return new Intl.DisplayNames([locale, 'en'], { type: 'region', fallback: 'code' });
  } catch {
    return null;
  }
}

// One country's name; the order is saved with the English name so the team can read every order.
export function countryName(code: string, locale = 'en'): string {
  return displayNames(locale)?.of(code) ?? code;
}

// All countries in the visitor's language, in that language's alphabetical order.
export function countryOptions(locale: string): CountryOption[] {
  const names = displayNames(locale);
  const collator = new Intl.Collator(locale);
  return COUNTRY_CODES.map((code) => ({ code, name: names?.of(code) ?? code })).sort((a, b) =>
    collator.compare(a.name, b.name),
  );
}

// English country name -> ISO code, built once. Orders, prayers and reviews store the English name.
let englishToCode: Map<string, string> | null = null;
export function codeOfEnglishName(name: string): string | undefined {
  englishToCode ??= new Map(COUNTRY_CODES.map((code) => [countryName(code, 'en').toLowerCase(), code]));
  return englishToCode.get(name.trim().toLowerCase());
}

/** A stored country in the reader's language when it is a known English country name; any other text unchanged. */
export function localCountryName(stored: string, locale: string): string {
  const code = codeOfEnglishName(stored);
  return code ? countryName(code, locale) : stored;
}
