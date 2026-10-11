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
| Holy City (Jerusalem only; never Nazareth: say "Nazareth" or "the city of the Annunciation") | Holy City | Ville Sainte | Ciudad Santa | Heilige Stadt | Città Santa | Cidade Santa | Miasto Święte |
| Annunciation | Annunciation | Annonciation | Anunciación | Verkündigung | Annunciazione | Anunciação | Zwiastowanie |
| Basilica of the Annunciation (Latin church) | Basilica of the Annunciation | basilique de l’Annonciation | Basílica de la Anunciación | Verkündigungsbasilika | Basilica dell’Annunciazione | Basílica da Anunciação | Bazylika Zwiastowania |
| Greek Orthodox church | Greek Orthodox church | église grecque orthodoxe | iglesia ortodoxa griega | griechisch-orthodoxe Kirche | chiesa greco-ortodossa | igreja ortodoxa grega | cerkiew grecko-prawosławna |
| Mary's Well (the old well house) | Mary's Well | puits de Marie | Pozo de María | Marienbrunnen | Pozzo di Maria | Poço de Maria | Studnia Maryi |
| Old City | Old City | vieille ville | Ciudad Vieja | Altstadt | Città Vecchia | Cidade Velha | Stare Miasto |
| Pilgrim / pilgrimage | pilgrim | pèlerin / pèlerinage | peregrino / peregrinación | Pilger / Pilgerreise | pellegrino / pellegrinaggio | peregrino / peregrinação | pielgrzym / pielgrzymka |
| Candle (light a candle) | candle | cierge (allumer un cierge) | vela (encender) | Kerze (anzünden) | candela (accendere) | vela (acender) | świeca (zapalić) |
| Rosary | rosary | chapelet | rosario | Rosenkranz | rosario | terço | różaniec |
| Stained glass | stained glass | vitrail | vitral | Buntglas | vetrata | vitral | witraż |
| Souvenir / keepsake | souvenir | souvenir | recuerdo | Andenken | souvenir | lembrança | pamiątka |
| Shop / cart | shop / cart | boutique / panier | tienda / carrito | Shop / Warenkorb | negozio / carrello | loja / carrinho | sklep / koszyk |
| Donate | donate | faire un don | donar | spenden | donare | doar | wesprzeć / przekazać darowiznę |
| Live broadcast | live | en direct | en vivo | live | in diretta | ao vivo | na żywo |
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



## The two churches, Mary's Well and the spring (07 review, 2026-10-07)

Three places are easy to confuse, so the facts and the words are fixed (the review found the same church called "Church
of the Annunciation", "Latin Church" and "Greek Church" on different pages):

- The **Basilica of the Annunciation** is the Catholic church (built 1960-1969, consecrated 1969, over the grotto). Never
  "Church of the Annunciation" alone, never "the Latin Church".
- The **Greek Orthodox Church of the Annunciation**, also called **St Gabriel's Church**, stands over the spring where
  Orthodox tradition places the Annunciation (the angel first greeted Mary as she drew water). The spring rises in its crypt.
- **Mary's Well** is the old well house about 140 metres away, once fed by that spring; it does not function today. The
  Annunciation is not placed at the well house itself.
- The candle picker (`candle.churches.latin|greek.name|tradition`) shows each church in full with its tradition ("Catholic" /
  "Orthodox · St Gabriel's Church").
- The Annunciation is on 25 March, and on 7 April at the Greek Orthodox church (Julian calendar).

| Term | fr | es | de | it | pt | pl | ru | uk | ro | nl | el | he | ar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Basilica of the Annunciation | basilique de l’Annonciation | Basílica de la Anunciación | Verkündigungsbasilika | Basilica dell’Annunciazione | Basílica da Anunciação | Bazylika Zwiastowania | базилика Благовещения | базиліка Благовіщення | Bazilica Buna Vestire | Annunciatiebasiliek | Βασιλική του Ευαγγελισμού | בזיליקת הבשורה | بازيليكا البشارة |
| Greek Orthodox Church of the Annunciation | église grecque orthodoxe de l’Annonciation | iglesia ortodoxa griega de la Anunciación | griechisch-orthodoxe Verkündigungskirche | chiesa greco-ortodossa dell’Annunciazione | Igreja Ortodoxa Grega da Anunciação (generic: a igreja ortodoxa grega) | cerkiew grecko-prawosławna Zwiastowania | греческая православная церковь Благовещения | грецька православна церква Благовіщення | biserica greco-ortodoxă Buna Vestire | Grieks-orthodoxe Annunciatiekerk (short: Grieks-orthodoxe kerk) | Ελληνορθόδοξος Ναός του Ευαγγελισμού (short: Ελληνορθόδοξος Ναός) | כנסיית הבשורה היוונית־אורתודוקסית (short: הכנסייה היוונית־אורתודוקסית) | كنيسة البشارة للروم الأرثوذكس (short: كنيسة الروم الأرثوذكس) |
| St Gabriel's Church | église Saint-Gabriel | iglesia de San Gabriel | Gabrielskirche | chiesa di San Gabriele | Igreja de São Gabriel | cerkiew św. Gabriela | церковь Архангела Гавриила | церква Архангела Гавриїла | Biserica Sfântul Arhanghel Gavriil | Sint-Gabriëlkerk | Ναός του Αρχαγγέλου Γαβριήλ | כנסיית גבריאל הקדוש | كنيسة مار جبرائيل |
| Mary's Well | puits de Marie (also called fontaine de la Vierge) | Pozo de María (also «Fuente de la Virgen» once, as the other name) | Marienbrunnen (also called Jungfrauenbrunnen; the building: Brunnenhaus) | Pozzo di Maria (once «Fontana della Vergine» as the other name) | Poço de Maria (the structure described as 'o antigo chafariz'; alternative name 'Fonte da Virgem' only in contentMary.intro) | Studnia Maryi | колодец Марии (alias in the intro: фонтан Девы Марии) | колодязь Марії (alias in the intro: фонтан Діви Марії) | Fântâna Mariei | Mariabron (the structure: bronhuis / fontein; alias 'Fontein van de Maagd') | Πηγάδι της Παναγίας | מעיין מרים (also known as מעיין הבתולה) | عين العذراء |
| the spring (in the Greek church) | la source (qui jaillit à l’intérieur / dans la crypte de l’église grecque orthodoxe) | el manantial | die Quelle (entspringt in der Krypta der griechisch-orthodoxen Verkündigungskirche) | la sorgente | a fonte (que brota dentro da Igreja Ortodoxa Grega da Anunciação) | źródło (we wnętrzu / w krypcie cerkwi) | источник | джерело | izvorul | de bron (die in de kerk / in de crypte ontspringt) | η πηγή | המעיין (הנובע בתוך כנסיית הבשורה היוונית־אורתודוקסית / בקריפטה שלה) | النبع (الذي يتدفّق داخل كنيسة البشارة للروم الأرثوذكس / في سردابها) |
| city of the Annunciation | la ville de l’Annonciation | la ciudad de la Anunciación | die Stadt der Verkündigung | la città dell’Annunciazione | a cidade da Anunciação | miasto Zwiastowania | город Благовещения | місто Благовіщення | orașul Bunei Vestiri | de stad van de Annunciatie | η πόλη του Ευαγγελισμού | עיר הבשורה | مدينة البشارة |
| candle | cierge | vela | Kerze | candela | vela | świeca | свеча | свічка | lumânare | kaars | κερί | נר (נר תפילה) | شمعة |
| light a candle | allumer un cierge | encender una vela | eine Kerze anzünden (FAQ and candle question: «das Entzünden einer Kerze») | accendere una candela | acender uma vela | zapalić świecę | зажечь свечу | запалити свічку | Aprindeți o lumânare | een kaars aansteken | Ανάψτε ένα κερί | הדליקו נר (imperative) / הדלקת נר (noun, buttons and titles) | أشعل شمعة (noun إشعال شمعة; never أوقد / أضاء) |
| Confirm email address | Confirmez votre adresse e-mail | Confirma tu correo electrónico | E-Mail-Adresse bestätigen | Conferma l’indirizzo email | Confirme o e-mail (candle.confirmEmail and paypalComponent.confirmEmail) | Potwierdź adres e-mail | Подтвердите адрес электронной почты | Підтвердіть електронну адресу | Confirmați adresa de e-mail | Bevestig uw e-mailadres | Επιβεβαίωση διεύθυνσης email | אימות כתובת הדוא״ל | تأكيد عنوان البريد الإلكتروني |

The wider choices each language settled (one word per concept, per language) are in `docs/TRANSLATION-REVIEW.md`. Arabic month names written in messages are Levantine (كانون الثاني ... كانون الأول); dates are formatted as `ar-PS` (see "Numbers").

## Feast names

The names of the feasts of the Church year, Catholic and Orthodox, in every language are the ones in
`web/src/messages/<language>.json` under `pilgrim.calendar.feasts` (`name` for the Catholic name, `orthodoxName` for
the Orthodox one where it differs). Use those words anywhere else on the site; their open questions are in
`docs/TRANSLATION-REVIEW.md` and their sources and conventions in `docs/LITURGICAL-CALENDAR.md`.

## Numbers

- **Western digits (0-9) everywhere**, in Hebrew and Arabic too. Arabic-Indic digits (٠-٩) are never used:
  a pilgrim shop quotes prices in US dollars, customers compare them with their card statement, and Arabic
  and Hebrew web users in the region read Western digits as a matter of course. Prices, dates and counts are
  formatted with `numberingSystem: 'latn'`, so a browser whose default for `ar` is Arabic-Indic digits
  (older engines) still shows 0-9. A unit test fails if a message contains an Arabic-Indic digit.
- Prices are always USD, formatted by `Intl.NumberFormat` for the page language (`$3.00`, `3,00 $`, `US$ 3,00`,
  `‏3.00 ‏$`). Never write `$` by hand next to a number in a message.
- Dates in Arabic use the **Levantine month names** Nazareth uses (`ar-PS`: "تشرين الأول", not "أكتوبر"), still with Western digits: `formatDateTime` / `dateLocale` in `web/src/lib/time.ts`.
- Dates and times are shown in **Nazareth time** (`Asia/Jerusalem`) with `Intl.DateTimeFormat` / next-intl,
  whatever the visitor's own time zone. The one addition: an announced live broadcast on `/live` also shows its start
  on the visitor's own clock, labelled ("Your time", with the zone's short name), when that differs from Nazareth's.
- Lengths of recordings use the language's own short units through `Intl` ("1 hr 5 min", "1 Std., 5 Min."), never
  units written into a message.
- Counts that change the wording use ICU plurals (see Rules).
