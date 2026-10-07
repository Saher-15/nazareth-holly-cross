# Translation review: what a native speaker still has to check

Every language file was read line by line against English in this pass. The wording was corrected
where it was plainly wrong, and **everything that is a matter of taste, tradition or local usage is listed
here for a native speaker**. Nothing below has been confirmed by a native reader. Hebrew and Arabic come
first (the owner speaks them), then Greek, then the languages in the order of the language menu.

How to use this list: open `web/src/messages/<language>.json`, search the key, change the text, run
`npm test` in `web/` (it checks keys, placeholders, plural forms and script mixing), and look at the page.
Approved terms are in `docs/GLOSSARY.md`; keep them when you change a text.

## Content and translation review 07 (2026-10-07): what was applied, what is left

Source: the content and localisation review in `C:\Users\saher\nhc\review\07-content-i18n.md` with 13 native-level
reviews (`review\scripts\07\findings-<locale>.json`) and their 810 checked fixes (`review\07-fixes.json`). Branch
`fix/content-i18n`.

### Applied

- **High-confidence fixes**: every one whose reviewed text still matched the file, validated (ICU, placeholders,
  apostrophes, spacing). **Medium** ones were read in context per language and applied only when clearly better.
  Counts per language are in the table below.
- **English source** (`en.json`), then every language: /about no longer claims to be "the official portal of
  Nazareth"; the home story says the Annunciation is where Mary received the angel's message and said yes (not
  "where Jesus first heard His calling") and no longer has souvenirs carrying "the holy spirit of the city"; "Holy City"
  (which means Jerusalem) is no longer used for Nazareth ("the city of the Annunciation"); the Catholic **Basilica of
  the Annunciation** and the **Greek Orthodox Church of the Annunciation (St Gabriel's)** have distinct names
  everywhere (no "Church of the Annunciation" for the basilica, no "Latin Church"); the candle picker names each
  church in full with its tradition; Mary's Well is the old well house, the spring rises about 140 m away inside the
  Greek Orthodox church where Orthodox tradition places the Annunciation (consistent with the Greek church page and
  the map); "Confirm email address"; Tel Aviv about 1½ hours by car with direct buses; the basilica built 1960-1969;
  the Orthodox Annunciation on 7 April; sentence case for the legacy headings; the Old City page shows the original
  city and Greek church paragraphs instead of three drifted copies.
- **FAQ "Which languages?"** (and its FAQPage structured data): the list is generated from `routing.locales` with
  `Intl.DisplayNames` and `Intl.ListFormat` (`languageList` in `web/src/data/pilgrim/faqEntries.ts`); it can no longer
  fall behind (it named 11 of 14).
- **Home "next feast"** comes from the calendar module (`nextFeasts`), so it agrees with /live; Palm Sunday has an
  Orthodox name (`orthodoxName`) in all 14 languages.
- **Arabic dates** are formatted as `ar-PS` (Levantine months, "تشرين الأول") with Western digits
  (`dateLocale` / `formatDateTime` in `web/src/lib/time.ts`).
- **Per-language consistency**: see the table.

### Counts per language

| Language | Fixes in the review | Applied | Applied with changes | Skipped | Superseded | Per-language consistency work |
|---|---|---|---|---|---|---|
| French (fr) | 35 | 26 | 4 | 4 | 1 | one word "cierge" for church candles (30 keys); no-break spaces added in 89 keys |
| Spanish (es) | 58 | 45 | 7 | 5 | 1 | tu everywhere (the 31 shop keys and the FAQ); one variety (en vivo, añadir, vídeo) |
| German (de) | 34 | 23 | 4 | 6 | 1 | Sie; "Kirche:" for the candle summary; Buntglas, Andenken; one spelling Nathanael / Bethlehem |
| Italian (it) | 33 | 24 | 5 | 3 | 1 | "Nazaret" everywhere; one word "souvenir"; "diretta"; "email" |
| Portuguese (pt) | 205 | 193 | 9 | 2 | 1 | Brazilian only (the pilgrim block was European); one quotation-mark style; feminine brand |
| Polish (pl) | 55 | 45 | 5 | 4 | 1 | gender-neutral past forms; one name for the Greek church; grammar slips |
| Russian (ru) | 53 | 47 | 4 | 0 | 2 | one word for "intention"; Catholic and Orthodox Palm Sunday and Assumption names; Cyrillic А–Я sort |
| Ukrainian (uk) | 51 | 34 | 9 | 7 | 1 | one word for "intention"; slogans without calques; low-stock badge |
| Romanian (ro) | 44 | 26 | 8 | 7 | 3 | dumneavoastra register; Buna Vestire in two words; low-stock badge |
| Dutch (nl) | 38 | 28 | 3 | 4 | 3 | Jozef, Natanael; "Niet live"; Mariabron for the well, bronhuis for the building |
| Greek (el) | 53 | 32 | 6 | 13 | 2 | "Σχεδιασμός προσκυνήματος"; prayer button; calques (τέμπλο, Αγία Τράπεζα); "ιεροί τόποι" |
| Hebrew (he) | 73 | 58 | 8 | 4 | 3 | maqaf in 14 more places; "צרו קשר"; "דוא״ל"; one name per place |
| Arabic (ar) | 50 | 45 | 3 | 0 | 2 | one name per church and for the well; tanween dropped under bare numbers; Levantine month names |
| **All 13** | **782** | **626** | **75** | **59** | **22** | English: 28 fixes applied by hand, plus the shared changes below |

"Applied" = from the review as proposed; "applied with changes" = adjusted to the shared facts or the language's own rules; "skipped" = Bible wording left for the owner or a reviewer proposal that was not clearly better; "superseded" = the key was deleted or rewritten by the shared changes (the FAQ languages answer, `home.today.feasts.*`).

### Bible quotations: which translation each language should adopt (owner / native follow-up)

The quotations were **not** replaced by the reviewers' proposed "standard" texts: those were written from memory and
were not checked against printed Bibles. Only the same verse was made identical across pages within a language
(home story, verse of the day, /gospel) and plain grammar errors were fixed. To finish, take the exact text of one
recognised translation per language from a printed copy (and check its quotation allowance):

- **French (fr)**: AELF (traduction officielle liturgique de la Bible, 2013), as the reviewer proposes. No grammar errors were reported in the fr quotations. The reviewer's AELF texts for luke1/luke126, luke4/luke416, luke251, home.v6 and the rest of matthew were not applied: check them against a printed AELF before replacing the quotations.
- **Spanish (es)**: Sagrada Biblia, versión oficial de la Conferencia Episcopal Española (CEE, 2010). The quotations still mix Reina-Valera (Protestant: «día de reposo», «se cumpliese», «Ven y ve» was removed) with near-CEE wording. Pairs now match word for word using existing wording; moving every quotation (home.v1-v6, scripture notes, Gospel page) to the printed CEE text is the owner's decision and needs a check against a printed copy.
- **German (de)**: Einheitsübersetzung 2016, as the reviewer proposes (the site keeps the Duden spellings Nazareth and Bethlehem). No grammar errors were found in the de quotations. They still mix Luther (luke251, john «sprach… spricht», home.v5) and EÜ-style wording; the reviewer's EÜ texts were not applied because nobody checked them against a printed EÜ.
- **Italian (it)**: La Sacra Bibbia, Conferenza Episcopale Italiana (CEI 2008). The quotations are close to CEI 2008 but keep CEI 1974 wording in places: «Eccomi, sono la serva» (home.v5), «era stato allevato» (Lk 4:16), «Nel sesto mese» (CEI 2008: «Al sesto mese»), «affinché si adempisse … dai profeti» (CEI 2008: «perché si compisse … per mezzo dei profeti»). Pairs now match word for word; moving everything to the printed CEI 2008 text is the owner's call.
- **Portuguese (pt)**: Bíblia Sagrada – Tradução Oficial da CNBB (the text of the Brazilian Lectionary), keeping its 'tu' forms. The pt quotations mix Almeida-style (Protestant) wording ('achaste graça', 'era-lhes submisso', 'fora dito') with Catholic forms. Only the overlaps were unified from existing wording, 'David' became 'Davi' (as in the other copy and every Brazilian Bible) and Brazilian quotation marks were applied. The reviewer's full CNBB proposals for home.v1, pilgrim.gospel.p.luke251.quote, scriptureNotes.matthew/john/luke4 and luke416.quote are in the fix sheet and need checking against a printed CNBB Bible before use.
- **Polish (pl)**: Biblia Tysiąclecia (BT, 5th edition). Capitalisation: «na Nim», «za Mną» (Jesus) and «Dziewicy» (Łk 1,27, with the BT comma before «imieniem»). Reference prefixes of the four scripture notes now use the Polish sigla Mt, J, Łk (the quotation wording is unchanged). The reviewer's BT wording for Mt 2,23, J 1,46, Łk 2,40, Łk 2,51 and Łk 4,16 was NOT applied: check against a printed BT and then change both members of each pair together.
- **Russian (ru)**: Synodal translation (Синодальный перевод). In every pair the existing Synodal wording of the scripture note was kept and copied to the other key. Capitalisation of the pronouns for the Virgin (Ты, Раба, Мне) and for Christ (Он) follows the Synodal text. Not changed, for a check against a printed Synodal Bible: Lk 2:51 «Матерь же Его» (reviewer: «И Матерь Его»), Jn 1:46 note «Нафанаил сказал ему» (Synodal has «Нафанаил же сказал ему»), and a possible comma «в синагогу, и встал читать» in Lk 4:16.
- **Ukrainian (uk)**: Ohiienko (Біблія в перекладі Івана Огієнка). The current quotations are not Ohiienko; the reviewer gave the full Ohiienko text for every verse (home.v1-v6, the scripture notes, the gospel-page quotes), but these were not checked against a printed Bible, so only grammar/case/capitalisation fixes and the task D alignment were made. In each pair the existing wording closer to Ohiienko was kept (for Lk 4:16 the gospel-page wording, which matches Ohiienko's word order more closely). Note: Ohiienko writes «з Назарету» inside quotations while the site's prose uses «Назарета».
- **Romanian (ro)**: Biblia Sinodală of the Romanian Orthodox Church (BOR, 1988 / 2008 edition), which matches the Iisus / Gavriil forms used on the whole site. The current quotations are Cornilescu (Protestant) wording with Orthodox names swapped in, so they match no printed Bible; home.v5 uses the Catholic 'slujitoarea'. The reviewer's Synodal proposals are in fix-ro.txt (luke 2:51 and Matthew 2:23 were written from memory, low confidence). Check them against a printed BOR Bible before adopting them.
- **Dutch (nl)**: NBV21 (Nieuwe Bijbelvertaling 2021), keeping the Taalunie spelling 'Nazareth' instead of NBV's 'Nazaret'. Name spellings fixed inside quotations: Josef -> Jozef (Luke 1:27), Nathanaël -> Natanaël (John 1:46). The quotations still mix NBV and older NBG/Willibrord wording. The reviewer's NBV21 texts for home.v1, v2 (question), v5 and v6 were NOT applied: check against a printed NBV21 and change each pair together.
- **Greek (el)**: The Patriarchal text of the New Testament (Ecumenical Patriarchate, 1904, Antoniades edition) in monotonic spelling, the text read in Greek Orthodox churches. The reviewer found no grammar errors; the quotations are modern renderings made from the English (NIV traces in home.v4 and home.v6). In each pair the /gospel wording was kept because it is closer to the Patriarchal text (passive 'στάλθηκε από τον Θεό', 'από τον οίκο', 'κατά τη συνήθειά του'). Full Patriarchal proposals for every quotation are in fix-el.txt; if the owner adopts them, also change pilgrim.gospel.intro.title and pilgrim.gospel.p.john146.text to «Έρχου και ίδε». Check them against a printed edition first.
- **Hebrew (he)**: Delitzsch (Franz Delitzsch's Hebrew New Testament), proposed by the reviewer from memory: check against a printed edition; the Bible Society's modern Hebrew New Testament is the alternative named in TRANSLATION-REVIEW.md. For each pair the existing wording closer to Delitzsch was kept (gospel-page wording for Luke 1:26-27 and 4:16, the scripture-note opening «בא וישב» for Matthew 2:23). The two tense errors were waw + perfect forms that read as future in biblical Hebrew («ובא», «והיה», «ועמד»); they are now waw-consecutive («ויבוא», «ויהי», «ויקם»). No quotation was replaced by a reviewer's 'standard' text. The quotations remain hand-made: the gospel page reads biblical, the home page modern.
- **Arabic (ar)**: Van Dyck (Smith–Van Dyck Arabic Bible): the reviewer found all 12 quotations already match it word for word; the Catholic Jesuit translation is the alternative named in TRANSLATION-REVIEW.md. No quotation text was changed except the punctuation of Luke 4:16. Isaiah 40:3 in the Advent note («أعدّوا طريق الرب») also matches Van Dyck.

### Not changed, and why (owner decisions)

- **Shop product names and descriptions are English-only** (they come from the database, not from the message
  files): all 13 translations show English product names, and the production descriptions have typos ("ofcana",
  "begining") and "the holy spirit" in lower case. A multilingual product feature (per-language name and description
  in the catalogue and the admin) is needed; until then, at least correct the English copy in the admin (07 A8).
- **Wine and liquids shipped worldwide**: "cana red wine", "Olive oil" and the water set are offered with worldwide
  delivery. Check Israel Post's rules (and destination countries) for alcohol and liquids, then restrict those items or
  add a note to the shipping page (07 A9). A legal/shipping promise: not changed without the owner.
- **Bible editions**: above.
- **English Bible translation**: the English quotations still mix NKJV and NIV-style wording across verses (07 A27);
  choose one (for a Catholic and Orthodox audience e.g. NRSV-CE or RSV-2CE).
- **Accessibility statement** (07 A15): "WCAG 2.2 AA, the level IS 5568 also requires" should become "…which also
  covers the requirements of IS 5568", and Israeli regulations expect the coordinator's name and phone: a legal text.
- **Capitals stored in source messages** (`heroSection.lightCandle`, `candle.light` "LIGHT", 07 A24) and the home map's
  "The city of Nazareth 3 min" point (07 A29): design decisions, left for a design pass.
- **Ukraine and the revised calendar**: the Orthodox Church of Ukraine and the Ukrainian Greek Catholics moved to the
  revised calendar in 2023; `pilgrim.calendar.notes.orthodox` names only Greece and Romania. Owner's choice.
- **Portuguese**: Brazilian throughout; if Portuguese from Portugal matters, add a separate `pt-PT` language.
- **The Old City page** now reuses the city and Greek church paragraphs; real Old City content (souk, Synagogue
  Church, St Joseph's) is still to be written.

### Open questions for a native speaker or the owner (from the language passes)

- **fr**: Bible quotations: adopt the printed AELF text for all fr quotations (home.v1-v6, whatIsNew.scriptureNotes.*, pilgrim.gospel.p.*.quote)? The reviewer's AELF proposals are in fix-fr.txt but were not checked against a printed copy.
- **fr**: about.description3: the keepsake set is rendered «un coffret souvenir d’eau, de terre, d’olive et d’encens»; confirm whether «olive» means olives, olive leaves or olive wood so the French can be precise.
- **es**: Bible: adopt the CEE text for every quotation? That changes home.v1 («has encontrado gracia ante Dios»), home.v5 («la esclava del Señor», as in the Angelus), Luke 4:16 («los sábados» instead of the Protestant «día de reposo») and the scripture notes; check against a printed CEE Bible first.
- **es**: Variety: the site mixes neutral/Latin American choices («en vivo», «costo») with Peninsular words («coche», «aparcar», «ordenador», «vídeo», «añadir»). The reviewer's choices were kept; decide whether Spanish targets Spain or Latin America before a full pass.
- **de**: Bible quotations: adopt the printed Einheitsübersetzung 2016 for all de quotations (home.v1-v6, whatIsNew.scriptureNotes.*, pilgrim.gospel.p.*.quote)? Several are Luther wording today.
- **de**: If the EÜ is adopted verbatim, its spellings «Nazaret», «Betlehem», «Natanaël», «Nazoräer» would differ from the site's «Nazareth», «Bethlehem», «Nathanael»: keep the site spellings inside quotations (the reviewer's choice) or quote the EÜ exactly?
- **it**: Bible: switch every quotation to the printed CEI 2008 text («Ecco la serva del Signore», «Al sesto mese», «dove era cresciuto», «perché si compisse … per mezzo dei profeti»)? Check against a printed copy first.
- **it**: pray.messagesTitle: keep «Le recensioni dei nostri clienti» or follow the new English («Cosa dicono i nostri visitatori»)? The wall collects visitors' words about the site, not only purchase reviews.
- **pt**: Bible: adopt the CNBB official translation (Brazilian Lectionary text) for every pt quotation? The reviewer's CNBB wordings are in fix-pt.txt and must be checked against a printed copy first.
- **pt**: GLOSSARY.md still lists « » for pt; the pt file now uses Brazilian “ ” / ‘ ’ throughout. Please update the glossary rule.
- **pt**: Brand gender: I made it feminine everywhere ('a Nazareth Holy Cross', 'Bem-vindo à Nazareth Holy Cross'), following the majority of uses. Confirm, or say if 'o Nazareth Holy Cross' (the site) is wanted.
- **pt**: about.description3: what is the 'olive' in the keepsake set (olive leaves, olive oil, olives)? I wrote the neutral 'oliva'.
- **pt**: 'Tour' is kept as an anglicism in the menu (site.nav.tour, common.tour) while other keys say 'Visita virtual' / 'Passeio': choose one word for pt.
- **pl**: Spelling: keep «grecko-prawosławna» (glossary) or switch to «greckoprawosławna» (the reviewer: Polish rules write it solid like rzymskokatolicki)? If switched, change the glossary and every key at once.
- **pl**: Bible: adopt the Biblia Tysiąclecia wording the reviewer proposed (home.v2, v3, v4, luke251, the four scripture notes and their gospel/home twins) after checking a printed BT.
- **pl**: about.description3: the keepsake set is translated as water, soil, OLIVES and incense; confirm whether the product holds olives, olive oil or olive leaves.
- **ru**: Catholic calendar names now follow the reviewer: «Вербное воскресенье», «Принесение Господа во храм (Сретение)», «Святой Иосиф, Обручник Пресвятой Девы Марии», «Торжество всех святых». A Russian Catholic priest should confirm them against the Russian Missal (some Catholic calendars use «Пальмовое воскресенье»).
- **ru**: Check the Russian Bible quotations against a printed Synodal Bible: Lk 2:51 («Матерь же Его» or «И Матерь Его»), Jn 1:46 (missing «же»), Lk 4:16 (comma).
- **ru**: St Gabriel's: «церковь Архангела Гавриила» is used; Russian Orthodox pilgrims also say «храм Архангела Гавриила». Keep one.
- **uk**: Bible: switch every Ukrainian quotation to the printed Ohiienko text (the reviewer's proposals are ready in fix-uk.txt: home.v1-v6, the four scripture notes, the gospel-page quotes)? Needs a check against a printed copy.
- **uk**: pilgrim.calendar.notes.orthodox: the Orthodox Church of Ukraine (and the UGCC) moved to the revised calendar in September 2023. Add it to the English and Ukrainian note as an example next to Greece and Romania?
- **uk**: Catholic calendar names now follow the reviewer: «Об’явлення Господнє (Богоявлення)», «Попільна середа», «Урочистість усіх святих». A Roman Catholic priest in Ukraine should confirm them.
- **uk**: shopPage.lowStock on the product page still reads «Залишилося лише {count}» (not cramped there); say if it should also become «Лише {count} шт.».
- **ro**: Bible: switch every quotation to the Synodal Bible (BOR), e.g. home.v5 'Iată roaba Domnului. Fie mie după cuvântul tău!' instead of the Catholic 'slujitoarea'? The proposals are ready in fix-ro.txt; a native reader should check them against a printed copy.
- **nl**: Bible: switch every quotation to NBV21 after checking a printed copy (home.v1 would then use 'je', the angel addressing Mary).
- **nl**: In running text the feast is 'de Annunciatie' (glossary); the reviewer says Dutch Catholics call it 'Maria-Boodschap'. Keep the glossary word, or use 'Maria-Boodschap' outside the calendar too?
- **nl**: Optional style changes left out: 'Beloken Pasen' for Divine Mercy Sunday, 'Fotoverantwoording' for 'Fotocredits'.
- **el**: Bible: replace every quotation with the Patriarchal text (older Koine wording such as «Μη φοβού, Μαριάμ· εύρες γαρ χάριν παρά τω Θεώ»), which Orthodox readers know from church, or keep the current modern renderings? Proposals are ready in fix-el.txt; a native reader should check them against a printed edition.
- **el**: Catholic name of 15 August: keep 'Ανάληψη της Θεοτόκου' or use 'Κοίμηση και Μετάσταση της Θεοτόκου' (reviewer, low confidence)? Check against the Greek Catholic Ordo.
- **el**: Catholic name of 25 March: 'Ευαγγελισμός του Κυρίου' (Missal) or 'Ευαγγελισμός της Θεοτόκου', which Greeks, Catholics included, use (reviewer, low confidence)?
- **el**: Rosaries: the shop says 'Κομποσκοίνια' (Orthodox knotted prayer rope). If the products are bead rosaries with a crucifix, Greek buyers say 'ροζάριο'; check the products before changing the glossary.
- **he**: Bible text: confirm Delitzsch (or the Bible Society's modern Hebrew NT) and paste the printed wording into home.v1-v6, whatIsNew.scriptureNotes.* and pilgrim.gospel.p.*.quote; today each verse has one wording, but the wording is still hand-made.
- **he**: St Gabriel's Church: «כנסיית גבריאל הקדוש» was chosen (like «כנסיית יוסף הקדוש»); say if Nazareth usage prefers «כנסיית המלאך גבריאל».
- **he**: Advent: pilgrim.calendar.feasts.advent2.description quotes Isaiah 40:3 as «פנו את דרך האדון»; the biblical text is «פנו דרך ה׳». Approve dropping «את» (left unchanged under the quotation rule).
- **he**: pilgrim.calendar.feasts.holySaturday.name «השבת הקדושה» echoes the Jewish «שבת קודש»; the reviewer suggests «יום שבת הקדוש» (low confidence): ask a Hebrew-speaking priest.
- **ar**: Bible text: the quotations are Van Dyck word for word; confirm Van Dyck, or say if the Catholic Jesuit translation is wanted.
- **ar**: St Gabriel's Church: «كنيسة مار جبرائيل» is used (pre-filled, kept); confirm it against the name used in Nazareth («كنيسة القديس جبرائيل» / «كنيسة الملاك جبرائيل»).
- **ar**: Mary's Well: only «عين العذراء» is used now. The reviewer named «عين مريم» as the real local alternative; say if it should appear once as 'also known as' in contentMary.intro.
- **ar**: Palm Sunday: the Orthodox name is the same as the Catholic one («أحد الشعانين»); if a distinct Orthodox label is wanted, «دخول السيد إلى أورشليم».

- **All**: `placesPage.kind.maryswell` and `placesPage.teaser.maryswell` were changed in English only (Mary's Well is "a historic well house", fed by the spring); the 13 translations still say "spring" there and need the same small change.
- **All**: the keepsake set contains "olive" (water, soil, olive, incense): olives, olive oil or leaves? Each language guessed; check with the product.
- **uk**: should `shopPage.lowStock` (product page) also become «Лише {count} шт.»?


## What was fixed in the first pass (so nobody repeats it)

| Problem found | Where | Languages |
|---|---|---|
| Sentences broken by a bad machine translation: `…sсhurch, zünde die Kerze an, nimm…`, `Iremos até a igreja hurch, acenda…`, `in der Kirchehurch`, `Pójdziemy dohurch, zapal…` | `candle.step3`, `contentGreek.paragraph2`, `contentMary…culturalExperienceText` | ru pl de it pt |
| Latin letters inside Cyrillic words (`Сhurch`, `Шиpping`, `МарииWell`) and English words left in (`LIGHT`, `Shipping: $5`, `Modern Nazareth`, `E-maile nie match`, `Jesus City`, `EPIC`) | many legacy keys | ru pl it pt de |
| Invisible zero-width characters inside strings | `heroSection.heading`, `confirmationCandle.receipt`, … | de pt ru it |
| Two registers in one language: Sie/du (de), usted/tú (es), Ty/ty (pl), pt-BR/pt-PT (pt), tu/voi (it) | shop, checkout and legacy blocks | de es pl pt it |
| Two names for one place (`Church of the Annunciation` for both the basilica and the Greek church; `source`/`puits` for Mary's Well; `Nazareth`/`Nazaret`) | all | fr es de it ru pl pt el |
| A whole paragraph missing (`about.description4`), shifted one key down | `about.*` | es |
| Capital Letters On Every Word (English headline style) and French typography (no no-break space before `: ; ? !`, straight apostrophes) | legacy keys | fr es |
| Hyphen next to a Latin name or number in Hebrew text, which flips visually (`ל-{max}`, `ב-Nazareth`), and a copyright line that starts with © and the year before Hebrew/Arabic text | `checkoutPage…amount`, `…donateDescription`, `site.footer.rights` | he ar |
| Wrong script for A–Z in a sort label (`Όνομα (A–Z)`) | `shopPage.sortName` | el |

Items of the dead CRA-era namespaces (`common`, `cards`, `navbar`, `mapButton`, `confirmDetails`, `confirmed`,
`orderCancelled`) are not used by any page any more but are still translated, so the key parity test stays simple.
They can be deleted in all languages in one commit.

## Hebrew (he) and Arabic (ar): please check these first

### he

| Key | Question |
|---|---|
| `home.v1` … `home.v6`, `whatIsNew.scriptureNotes.*` | **Which Bible translation?** The Hebrew quotations follow the Hebrew New Testament wording ("הנני שפחת האדון; יהי לי כדברך") but were written by hand. Replace with the exact text of the translation you want shown (Delitzsch / the Bible Society's modern Hebrew New Testament). |
| `contentMary.*`, `home.siteMary`, `placesPage.kind.maryswell` | **"מעיין מרים" or "באר מרים"?** Both are used in Hebrew; the site uses "מעיין מרים" for Mary's Well and "מעיין" for the spring below the Greek church. |
| `contentGreek.*`, `home.siteGreek` | "הכנסייה היוונית־אורתודוקסית" (used) or the more common-in-press "הכנסייה האורתודוקסית היוונית"? |
| `home.title`, `heroSection.heading`, `heroSection.subHeading` | Slogans ("צעדו בעקבות ישוע", "עיר ישוע מחכה לכם", "חסד בכל לחיצה"): is the tone right for a Christian pilgrimage site, and does the owner want "ישוע" or "ישו"? ("ישוע", the form Christians use, is used everywhere.) |
| `checkoutPage.payment.reference` | "אסמכתה לתשלום" is the formal word; "מספר אישור" is easier to read. |
| `checkoutPage.payment.secured` | Now "תשלום מאובטח באמצעות PayPal", consistent with the other lines. |
| `communityPage.live.units.days` | Hebrew has a dual ("יומיים"); the countdown label uses "ימים" for 2 as well because it sits under a number. |
| `site.footer.rights` | Contains invisible bidi isolates (U+2066 … U+2069) so "© 2026 Nazareth Holy Cross" keeps its order inside Hebrew text. Do not retype it; copy the existing line. |
| all | Plural-masculine address ("הדליקו", "גלו") is used for everyone. Say if a different form is wanted. |
| `about.*`, `whatIsNew.introParagraphs.*`, `contentLatin.*` | Long marketing texts that came from the old site; they read correctly but should be read once for style. |

### ar

| Key | Question |
|---|---|
| `home.v1` … `home.v6`, `whatIsNew.scriptureNotes.*` | **Which Bible translation?** The quotations follow the Van Dyck (فاندايك) wording ("هوذا أنا أمة الرب. ليكن لي كقولك"). If the Catholic (Jesuit) translation is preferred for the Latin basilica, replace them. |
| `contentMary.*`, `home.siteMary` | **"عين العذراء", "عين مريم" or "بئر مريم"?** The site uses "عين العذراء" and mentions "بئر مريم" once as the other name. Use the name people in Nazareth use. |
| `home.siteLatin`, `contentLatin.*` | "بازيليكا البشارة" / "كنيسة اللاتين" is used. In everyday speech many say "كنيسة البشارة" for the Catholic basilica and "كنيسة الروم" for the Greek Orthodox one. |
| `home.title`, `heroSection.*` | "سِر حيث سار يسوع", "مدينة يسوع بانتظارك": check tone and the vowel marks (the vowel marks on "سِر" were added for the font). |
| `site.nav.reviews`, `pray.messagesTitle`, `communityPage.reviews.*` | "آراء الزوار" / "آراء عملائنا" for reviews. "تقييمات" is the alternative. |
| `communityPage.live.lead` | "قداديس" (Catholic Masses) next to "صلوات": the Greek Orthodox services are "خدم" / "صلوات". Is "قداديس" right for the broadcasts? |
| `communityPage.live.units.*` | The countdown label follows the full Arabic number rules (يوم، يومان، أيام، يومًا). Numbers 11 to 99 take the accusative form "يومًا", which looks unusual in a countdown. Simplify to one form if you prefer. |
| all | **Digits.** Western digits (0-9) are used on purpose (see GLOSSARY: Numbers). Tell us if Arabic-Indic digits are wanted for the Arabic site; it is a one-line change in the formatting helpers. |
| all | Masculine-singular address ("أشعل", "استكشف") is used for everyone. A plural or a neutral form ("يمكنكم …") can be used instead. |
| `site.footer.rights` | Same bidi isolates as in Hebrew; copy, do not retype. |

## Greek (el)

| Key | Question |
|---|---|
| `home.siteMary`, `contentMary.*`, `placesPage.*` | "Πηγάδι της Παναγίας" is used for Mary's Well and "πηγή" for the spring below the church, to keep them apart. Orthodox usage may prefer "Πηγή της Παναγίας". |
| `home.v1` … `home.v6`, `whatIsNew.scriptureNotes.*` | Modern-Greek wording, not the text of the Church's New Testament. Replace with the text your readers know. |
| `site.nav.live`, `communityPage.live.status.*` | "Ζωντανά" / "Σύντομα" / "Εκτός αέρα" |
| `email`, `paypalComponent.email` | Left as "Email"; "Ηλ. ταχυδρομείο" is the formal alternative. |

## Russian (ru)

| Key | Question |
|---|---|
| `home.v1` … `home.v6`, `whatIsNew.scriptureNotes.*` | Synodal translation wording, abbreviations Лк / Ин / Мф. Check against the printed text. |
| `home.siteMary`, `contentMary.*` | "колодец Марии" (used) or "источник Марии" / "Мариин колодец". |
| `placesPage.kind.greek` and all | "греческая православная церковь" (used) or "Греческая православная церковь Благовещения". |
| `shopPage.*` | "чётки" is used for the rosary; Catholic buyers may say "розарий". |
| `candle.*`, `heroSection.*` | Slogans were rewritten ("ГОРОД ИИСУСА ЖДЁТ ВАС"); the old texts used "Зажги" (informal) next to "Зажгите". |

## Ukrainian (uk), Romanian (ro), Dutch (nl): new languages

These three were written for this pass and **have not been read by a native speaker at all**.

| Language | Questions |
|---|---|
| uk | Bible: the wording follows the Ohiienko translation, abbreviations Лк / Ів / Мт. "колодязь Марії" for Mary's Well. "вервиці" for rosary (Catholic) versus "чотки". Apostrophe is U+2019 (’); the orthographic apostrophe U+02BC is also correct. "грецька православна церква": check that this wording is acceptable to Ukrainian readers. |
| ro | Bible: Cornilescu / Orthodox wording ("Iisus", "Buna Vestire"). **"Iisus" (Orthodox) or "Isus" (Catholic)?** Polite plural "dumneavoastră" is used throughout. "Fântâna Mariei", "rozariu" vs "mătănii", "lumânare". Dates and prices: `3,00 USD`. |
| nl | Bible: NBV wording, but "Nazareth" is spelt the Dutch way throughout (the NBV spells "Nazaret"). "u" (polite) is used throughout; "je" would be friendlier. "Annunciatiebasiliek" (Dutch Wikipedia) versus "Maria-Boodschapbasiliek"; "Mariabron". |

## Polish (pl), German (de), French (fr), Spanish (es), Italian (it), Portuguese (pt)

| Language | Questions |
|---|---|
| pl | **"cerkiew grecko-prawosławna" or "kościół prawosławny"?** "Cerkiew" is used consistently now. Bible quotations follow the Millennium Bible (Biblia Tysiąclecia) wording from memory; check the exact text. Capital Ty/Ci/Twój is used throughout (formal-friendly). |
| de | Bible: Einheitsübersetzung-style wording. "Glaskunst" for stained glass: "Glasmalerei" or "Bleiverglasung" are the precise words. "Andenken" vs "Souvenirs" used for the same product. "Shop" is kept (common German). |
| fr | Bible: TOB-style wording ("Sois sans crainte, Marie…"). "puits de Marie" is used everywhere; some sources say "fontaine de Marie". French typography (no-break spaces before `: ; ? !`) is applied by script: check the line breaks on mobile. |
| es | **tú is used everywhere** (the shop block used usted and was changed). Bible: Reina-Valera-style wording. "recuerdo" (souvenir) and "vitral". Neutral Spanish: "vídeo" is used throughout. |
| it | "Nazaret" everywhere (was mixed with "Nazareth"). Bible: CEI-style wording, written from memory; check. "Souvenir" and "ricordo" are both used for the product. |
| pt | **Brazilian Portuguese (pt-BR)** is now used everywhere; Portuguese from Portugal was mixed in on the reviews and live pages. If European Portuguese readers matter, the clean solution is a separate `pt-PT` language. Bible: Almeida-style wording ("Não tenhas medo, Maria"), which is slightly formal next to "você". |

## Christian calendar of `/live` (`pilgrim.calendar`, 2026-10-07)

The feast names follow the Roman Missal of each language for `name` and the Orthodox Church's own usage for
`orthodoxName` (`docs/LITURGICAL-CALENDAR.md`). They were written carefully but by machine: **a review by a native
speaker who knows the liturgy (ideally a priest or sacristan of each tradition) is recommended before anyone relies on
them.** Catholic and Orthodox usage differ inside one language, so check both columns. Open questions:

| Language | Check |
|---|---|
| he | Pentecost as "חג השבועות" (or "פנטקוסט"); Advent as "אדוונט"; "יום ראשון של הדקלים" (or "של כפות התמרים"); "יום שישי הטוב" (or "הקדוש"); "יום שני הנקי"; "חג פגישת האדון"; "חג הירדמות יולדת האלוהים"; "חג רוממות הצלב הקדוש"; "ההתעברות ללא חטא"; solemnity as "חג בדרגת חגיגה"; the traditions as nouns ("קתולים", "אורתודוקסים") so they agree with every feast |
| ar | Catholic Epiphany "عيد الدنح" (Melkites: "الظهور الإلهي"); Orthodox Pentecost "أحد العنصرة" without "(Holy Trinity)", which is not local usage; "خميس الأسرار", "السبت المقدس", Easter as "أحد القيامة" (Catholic) and "عيد الفصح المجيد" (Orthodox); "خطيب مريم" for St Joseph; "التطوافات"; month names written "كانون الثاني/يناير" in the notes |
| el | Advent as "Κυριακή της Παρουσίας" (Παρουσία also means the Second Coming; "Αναμονής" or "Προσμονής"?); Catholic "Ανάληψη της Θεοτόκου" for the Assumption; "Επιφάνεια του Κυρίου"; "Γέννηση" or "Γενέθλιο της Θεοτόκου"; "Κυριακή της Θείας Ευσπλαχνίας"; "Μεγάλο" or "Μέγα Σάββατο" |
| ru | "Сретение Господне" also for the Catholic name (or "Принесение Господа во храм"); "Взятие ... на небо" (or "Успение"); "Пальмовое" or "Вербное воскресенье"; "Иерусалимский Православный Патриархат" (without "Greek"); the traditions as "Католическая Церковь" / "Православная Церковь" |
| uk | "Богоявлення Господнє" (Roman Catholics may say "Об’явлення Господнє"); "Внебовзяття"; "Пальмова" or "Вербна неділя"; "Воздвиження Хреста Господнього" for both (Roman Catholic "Підвищення Святого Хреста"?) |
| ro | Catholic names after the Romanian Catholic Missal ("Înălțarea la cer a Sfintei Fecioare Maria", "Preasfântul Trup și Sânge al Domnului", "Duminica Divinei Îndurări"); Orthodox Pentecost "Pogorârea Duhului Sfânt (Cincizecimea)" (the Romanian Orthodox keep the Holy Trinity on the Monday); "Iisus/Hristos" as on the rest of the site, where Romanian Catholics write "Isus/Cristos" |
| pl | The Missal titles "Uroczystość ..." for Mary Mother of God, St Joseph and the Trinity; Orthodox "Chrzest Pański (Teofania)", "Pięćdziesiątnica (Trójca Święta)", "Podwyższenie Krzyża Pańskiego"; "Wielki Czwartek/Piątek, Wielka Sobota" for both Churches; "W {month}" could not be used (the month is in the nominative), so the list heading is "Święta: {month}" |
| de | "Theophanie", "Begegnung des Herrn", "Verkündigung der Gottesgebärerin", the order "Heiliger und Großer Donnerstag"; "Pfingsten (Heilige Dreifaltigkeit)"; "Mariä Empfängnis"; "Betlehem" or "Bethlehem" |
| nl | "Aankondiging van de Heer" / "Annunciatie van de Moeder Gods"; "Grote en Heilige Donderdag"; "Ontslapen van de Moeder Gods"; "Schone Maandag"; "Goede Week" (Flemish) or "Stille Week" (Netherlands) |
| fr | "Croix glorieuse" (Missal) for the Catholic Holy Cross and "Exaltation de la Sainte Croix" for the Orthodox; "Sainte Pâque (Pâques)"; "Saint et Grand Jeudi"; "Mère de Dieu" or "Théotokos"; "Lundi pur"; "Rencontre du Seigneur"; "Ajouter au calendrier" here while the planner says "Ajouter à l’agenda" |
| es, it, pt | "Santo y Gran Jueves" / "Santo e Grande Giovedì" / "Santa e Grande Quinta-feira" (word order); "Lunes Puro", "Lunedì puro", "Segunda-feira Pura"; the Missal's long Corpus Christi names while the notes say "Corpus Christi" / "Corpus Domini"; pt "Nossa Senhora" in the Marian names |

## What was *not* done

- No native speaker has proofread any language (the 07 review was done by reviewers working from the message files, not by in-person native readers of the live pages). The lists above are the work to do.
- The long legacy texts (`about.*`, `whatIsNew.*`, `contentLatin.*`, `contentGreek.*`, `contentMary.*`,
  `contentNaz.*`) are Google-translate level in some languages; the worst damage was repaired, but they should
  be re-translated by a person if the site is to be called "world-class" in that language.
- Slogans and marketing lines (`heroSection.*`, `home.title`, `home.subtitle`) deserve a human copywriter in
  every language.
