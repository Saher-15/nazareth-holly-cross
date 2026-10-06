# Glossary: the approved word for each term, per language

One word per concept in every language, so the site never calls the same place two different things
(it used to: "Church of the Annunciation" for both the Latin basilica and the Greek Orthodox church,
"source" and "well" for Mary's Well, "ροζάρια" and "κομποσκοίνια" for the rosary ...). Translators and
anyone adding text use these words. The message files are checked by `tests/unit/messages.test.ts`,
but only a person can check the wording: see `docs/TRANSLATION-REVIEW.md` for what still needs a native speaker.

## Rules that apply to every language

- **Brand and proper names.** "Nazareth Holy Cross" is never translated or transliterated (it is the logo).
  Inside Hebrew, Arabic, Russian, Ukrainian and Greek text it stays in Latin letters and is joined to Hebrew
  prefixes with a maqaf (`ב־Nazareth Holy Cross`). Names such as PayPal, Instagram, Facebook, YouTube and
  Google also stay as they are.
- **The city's own spelling.** Use the spelling the language normally uses (see the table: *Nazareth* in
  en, fr, de, nl; *Nazaret* in es, it, pl, ro; *Nazaré* in pt). Never mix two spellings in one language
  (Italian had both *Nazareth* and *Nazaret*).
- **Two churches, two names.** *Basilica of the Annunciation* (Catholic, "Latin church") and *Greek Orthodox
  Church of the Annunciation* always get different words. The key `home.siteLatin` is the basilica,
  `home.siteGreek` the Greek Orthodox church.
- **Address.** One register per language, used everywhere: de **Sie**, fr **vous**, es **tú**, it **tu**,
  pt **você**, pl **Ty** (capitalised: Ci, Twój), ru **вы**, uk **ви**, ro **dumneavoastră**, nl **u**,
  el **εσείς** (plural), he plural address ("הדליקו", "צרו קשר"), ar masculine-singular address that also reads
  as general ("أشعل", "استكشف"). English uses "you".
- **Portuguese is Brazilian (pt-BR)**: *você*, *compartilhe*, *Carregando*, *aba*, *frete*, *vela*. European
  Portuguese (*partilhe*, *separador*, *ligação*) is not used. Portuguese readers understand the Brazilian text.
- **Digits.** Western digits (0-9) in every language, including Arabic and Hebrew. See "Numbers" below.
- **Typography.** French: a no-break space before `: ; ? ! »` and after `«`, and before `%` and `$`.
  French, Italian and the other Latin languages: the typographic apostrophe `’`, never `'` (a straight
  apostrophe can start an ICU quote). Quotation marks follow the language: « » fr es it pt ru uk, „ “ de pl ro,
  ‘ ’ nl, « » el, " " he ar (Arabic also « »).
- **Bible quotations** are quoted from a recognised translation of the language, never translated from English:
  see the review list for which one each language uses.
- **Plurals.** Never build a plural by hand. Use ICU `{count, plural, ...}`; the tests insist that Russian,
  Ukrainian and Polish spell out `one few many other`, Arabic `one two few many other`, Romanian `one few other`.

## Terms

| Term | en | fr | es | de | it | pt (BR) | pl |
|---|---|---|---|---|---|---|---|
| Nazareth | Nazareth | Nazareth | Nazaret | Nazareth | Nazaret | Nazaré | Nazaret |
| Holy Land | Holy Land | Terre sainte | Tierra Santa | Heiliges Land | Terra Santa | Terra Santa | Ziemia Święta |
| Holy City | Holy City | Ville Sainte | Ciudad Santa | Heilige Stadt | Città Santa | Cidade Santa | Miasto Święte |
| Annunciation | Annunciation | Annonciation | Anunciación | Verkündigung | Annunciazione | Anunciação | Zwiastowanie |
| Basilica of the Annunciation (Latin church) | Basilica of the Annunciation | basilique de l’Annonciation | Basílica de la Anunciación | Verkündigungsbasilika | Basilica dell’Annunciazione | Basílica da Anunciação | Bazylika Zwiastowania |
| Greek Orthodox church | Greek Orthodox church | église grecque orthodoxe | iglesia ortodoxa griega | griechisch-orthodoxe Kirche | chiesa greco-ortodossa | igreja ortodoxa grega | cerkiew grecko-prawosławna |
| Mary's Well | Mary's Well | puits de Marie | Pozo de María | Marienbrunnen | Pozzo di Maria | Poço de Maria | Studnia Maryi |
| Old City | Old City | vieille ville | Ciudad Vieja | Altstadt | Città Vecchia | Cidade Velha | Stare Miasto |
| Pilgrim / pilgrimage | pilgrim | pèlerin / pèlerinage | peregrino / peregrinación | Pilger / Pilgerreise | pellegrino / pellegrinaggio | peregrino / peregrinação | pielgrzym / pielgrzymka |
| Candle (light a candle) | candle | bougie (allumer) | vela (encender) | Kerze (anzünden) | candela (accendere) | vela (acender) | świeca (zapalić) |
| Rosary | rosary | chapelet | rosario | Rosenkranz | rosario | terço | różaniec |
| Stained glass | stained glass | vitrail | vitral | Glaskunst¹ | vetrata | vitral | witraż |
| Souvenir / keepsake | souvenir | souvenir | recuerdo | Andenken | souvenir / ricordo | lembrança | pamiątka |
| Shop / cart | shop / cart | boutique / panier | tienda / carrito | Shop / Warenkorb | negozio / carrello | loja / carrinho | sklep / koszyk |
| Donate | donate | faire un don | donar | spenden | donare | doar | wesprzeć / przekazać darowiznę |
| Live broadcast | live | en direct | en vivo | live | live / in diretta | ao vivo | na żywo |
| Nazareth time (of a broadcast) | Nazareth time | heure de Nazareth | hora de Nazaret | Uhrzeit in Nazareth | ora di Nazaret | horário de Nazaré | czas w Nazarecie |
| Recording (of a broadcast) | recording | enregistrement | grabación | Aufzeichnung | registrazione | gravação | nagranie |
| Review | review | avis | reseña / opinión | Bewertung | recensione | avaliação | opinia |

| Term | ru | uk | ro | nl | el | he | ar |
|---|---|---|---|---|---|---|---|
| Nazareth | Назарет | Назарет | Nazaret | Nazareth | Ναζαρέτ | נצרת | الناصرة |
| Holy Land | Святая Земля | Свята Земля | Țara Sfântă | Heilige Land | Άγιοι Τόποι | ארץ הקודש | الأرض المقدسة |
| Holy City | Святой город | Святе місто | Cetatea Sfântă | Heilige Stad | Αγία Πόλη | העיר הקדושה | المدينة المقدسة |
| Annunciation | Благовещение | Благовіщення | Buna Vestire | Annunciatie | Ευαγγελισμός | הבשורה | البشارة |
| Basilica of the Annunciation (Latin church) | базилика Благовещения | базиліка Благовіщення | Bazilica Buna Vestire | Annunciatiebasiliek | Βασιλική του Ευαγγελισμού | בזיליקת הבשורה | بازيليكا البشارة |
| Greek Orthodox church | греческая православная церковь | грецька православна церква | biserica greco-ortodoxă | Grieks-orthodoxe kerk | Ελληνορθόδοξος Ναός | כנסייה יוונית־אורתודוקסית | كنيسة الروم الأرثوذكس |
| Mary's Well | колодец Марии | колодязь Марії | Fântâna Mariei | Mariabron | Πηγάδι της Παναγίας | מעיין מרים | عين العذراء |
| Old City | Старый город | Старе місто | Orașul Vechi | Oude Stad | Παλιά Πόλη | העיר העתיקה | البلدة القديمة |
| Pilgrim / pilgrimage | паломник / паломничество | паломник / паломництво | pelerin / pelerinaj | pelgrim / pelgrimstocht | προσκυνητής / προσκύνημα | צליין / עלייה לרגל | حاج / حجّ |
| Candle (light a candle) | свеча (зажечь) | свічка (запалити) | lumânare (a aprinde) | kaars (aansteken) | κερί (ανάβω) | נר (להדליק) | شمعة (أشعل) |
| Rosary | чётки | вервиця | rozariu | rozenkrans | κομποσκοίνι | מחרוזת תפילה | مسبحة |
| Stained glass | витраж | вітраж | vitraliu | glas-in-lood | βιτρό | ויטראז׳ | زجاج معشّق |
| Souvenir / keepsake | сувенир | сувенір | suvenir | souvenir / aandenken | ενθύμιο | מזכרת | تذكار |
| Shop / cart | магазин / корзина | магазин / кошик | magazin / coș | winkel / winkelwagen | κατάστημα / καλάθι | חנות / סל הקניות | المتجر / السلة |
| Donate | пожертвовать | пожертвувати | a dona | doneren / een gift | δωρεά | תרומה | تبرّع |
| Live broadcast | прямой эфир | прямий ефір / наживо | în direct | live | ζωντανά | שידור חי | بث مباشر |
| Nazareth time (of a broadcast) | время в Назарете | час у Назареті | ora din Nazaret | tijd in Nazareth | ώρα Ναζαρέτ | שעון נצרת | توقيت الناصرة |
| Recording (of a broadcast) | запись | запис | înregistrare | opname | εγγραφή | הקלטה | تسجيل |
| Review | отзыв | відгук | recenzie | review | κριτική | חוות דעת | رأي / آراء الزوار |

¹ German "Glaskunst" is what the shop copy uses; "Glasmalerei" / "Buntglas" would be the precise word and is on the review list.

## Numbers

- **Western digits (0-9) everywhere**, in Hebrew and Arabic too. Arabic-Indic digits (٠-٩) are never used:
  a pilgrim shop quotes prices in US dollars, customers compare them with their card statement, and Arabic
  and Hebrew web users in the region read Western digits as a matter of course. Prices, dates and counts are
  formatted with `numberingSystem: 'latn'`, so a browser whose default for `ar` is Arabic-Indic digits
  (older engines) still shows 0-9. A unit test fails if a message contains an Arabic-Indic digit.
- Prices are always USD, formatted by `Intl.NumberFormat` for the page language (`$3.00`, `3,00 $`, `US$ 3,00`,
  `‏3.00 ‏$`). Never write `$` by hand next to a number in a message.
- Dates and times are shown in **Nazareth time** (`Asia/Jerusalem`) with `Intl.DateTimeFormat` / next-intl,
  whatever the visitor's own time zone. The one addition: an announced live broadcast on `/live` also shows its start
  on the visitor's own clock, labelled ("Your time", with the zone's short name), when that differs from Nazareth's.
- Lengths of recordings use the language's own short units through `Intl` ("1 hr 5 min", "1 Std., 5 Min."), never
  units written into a message.
- Counts that change the wording use ICU plurals (see Rules).
