# Translation review: what a native speaker still has to check

Every language file was read line by line against English in this pass. The wording was corrected
where it was plainly wrong, and **everything that is a matter of taste, tradition or local usage is listed
here for a native speaker**. Nothing below has been confirmed by a native reader. Hebrew and Arabic come
first (the owner speaks them), then Greek, then the languages in the order of the language menu.

How to use this list: open `web/src/messages/<language>.json`, search the key, change the text, run
`npm test` in `web/` (it checks keys, placeholders, plural forms and script mixing), and look at the page.
Approved terms are in `docs/GLOSSARY.md`; keep them when you change a text.

## What was fixed in this pass (so nobody repeats it)

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

- No native speaker has proofread any language. The list above is the work to do.
- The long legacy texts (`about.*`, `whatIsNew.*`, `contentLatin.*`, `contentGreek.*`, `contentMary.*`,
  `contentNaz.*`) are Google-translate level in some languages; the worst damage was repaired, but they should
  be re-translated by a person if the site is to be called "world-class" in that language.
- Slogans and marketing lines (`heroSection.*`, `home.title`, `home.subtitle`) deserve a human copywriter in
  every language.
