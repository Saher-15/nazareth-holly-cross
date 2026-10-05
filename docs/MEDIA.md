# Nazareth imagery: sources, licences and how to add more

Forty photographs of Nazareth and its churches, all from **Wikimedia Commons**, all public domain or under a
Creative Commons licence that allows reuse on a commercial website (CC BY, CC BY-SA). Each is shown with its
author, licence and a link to the original: in the photo viewer, on `/credits`, and in the page's structured data.

| What | Where |
|---|---|
| The curated list (Commons file, topic, subject, English alt text, focal point) | `web/scripts/media/sources.json` |
| Builder: licence check, download, resize, AVIF/WebP, blur placeholder, manifest | `web/scripts/media/build.mjs` |
| Candidate search on Commons (licence-filtered) | `web/scripts/media/search.mjs` |
| Generated files, `<id>/<width>.avif`, `<id>/<width>.webp`, `<id>/og.jpg` | `web/public/images/nazareth-media/` |
| Generated manifest (do not edit) | `web/src/data/media.generated.ts` |
| Types, `getMedia(id)` and the other helpers | `web/src/data/media.ts`, `media-types.ts` |
| Responsive `<picture>` component | `web/src/components/media/MediaPicture.tsx` |
| `/credits` (every photo, author, licence, source) | `web/src/app/[locale]/credits/` |
| `/gallery` (Nazareth in pictures, grouped by topic) | `web/src/app/[locale]/gallery/` |
| Translated strings (all 14 languages) | `media` namespace in `web/src/messages/*.json` |

## 1. The photos

40 photos, 37 MB in the repository (AVIF + WebP at 3 or 4 widths each; the largest file of a normal photo is
about 150 to 390 KB AVIF). Licences: CC BY-SA 4.0 (17), CC BY 2.5 (10), CC BY-SA 2.0 (5), CC BY-SA 3.0 (4),
CC BY 2.0 (3), public domain (1). Every source is at least 3,100 px wide; the site serves up to 1920 px (2560 px
for the 9 "hero" photos).

`kB` is the AVIF size at each width (640 / 1280 / 1920 / 2560 px). "hero" means a 2560 px file and a 1200x630
social card (`og.jpg`) exist.

| id | topic | author | licence | largest file | AVIF kB | hero |
|---|---|---|---|---|---|---|
| `basilica-facade` | basilica | Berthold Werner | CC BY-SA 3.0 | 2560x1447 | 17 / 55 / 109 / 174 | yes |
| `basilica-night-view` | basilica | Zxc0505 | CC BY-SA 3.0 | 2560x1714 | 32 / 90 / 166 / 256 | yes |
| `basilica-dome-palms` | basilica | Zairon | CC BY-SA 4.0 | 2560x1393 | 20 / 71 / 141 / 221 | yes |
| `basilica-dome-rooftops` | basilica | Zairon | CC BY-SA 4.0 | 1920x1424 | 34 / 104 / 196 | |
| `basilica-courtyard-dusk` | basilica | Mksg1 | CC BY-SA 4.0 | 1920x1440 | 24 / 82 / 166 | |
| `basilica-spring-flowers` | basilica | Adam Jones | CC BY-SA 2.0 | 1920x1280 | 42 / 182 / 385 | |
| `basilica-upper-nave` | basilica | Dennis G. Jarvis | CC BY-SA 2.0 | 1920x1280 | 31 / 98 / 188 | |
| `basilica-dome-interior` | basilica | Zairon | CC BY-SA 4.0 | 1920x1400 | 26 / 75 / 136 | |
| `basilica-grotto-altar` | basilica | Dennis G. Jarvis | CC BY-SA 2.0 | 1920x1280 | 23 / 76 / 160 | |
| `basilica-lower-church` | basilica | Larry Koester | CC BY 2.0 | 1920x1280 | 28 / 86 / 166 | |
| `basilica-night-front` | basilica | Fallaner | CC BY-SA 4.0 | 1920x1440 | 17 / 48 / 89 | |
| `stjoseph-facade` | stjoseph | Elaimon | CC BY-SA 4.0 | 1920x1440 | 38 / 123 / 234 | |
| `stjoseph-arcades` | stjoseph | Zicong Deng | CC BY-SA 3.0 | 1920x1280 | 22 / 67 / 126 | |
| `stjoseph-nave` | stjoseph | Britchi Mirela | CC BY-SA 4.0 | 1920x1440 | 24 / 68 / 128 | |
| `stjoseph-columns` | stjoseph | Britchi Mirela | CC BY-SA 4.0 | 1920x1440 | 24 / 67 / 125 | |
| `greek-church-exterior` | greek | Gerd Eichmann | CC BY-SA 4.0 | 2560x1529 | 21 / 65 / 126 / 196 | yes |
| `greek-church-porch` | greek | Berthold Werner | Public domain | 1920x1502 | 20 / 68 / 136 | |
| `greek-nave-chandeliers` | greek | Zairon | CC BY-SA 4.0 | 1920x1325 | 34 / 99 / 179 | |
| `greek-iconostasis` | greek | Zairon | CC BY-SA 4.0 | 1920x1400 | 41 / 115 / 200 | |
| `greek-painted-vault` | greek | Zairon | CC BY-SA 4.0 | 1920x1425 | 37 / 99 / 170 | |
| `greek-spring-grotto` | greek | Gerd Eichmann | CC BY-SA 4.0 | 1920x1280 | 28 / 89 / 166 | |
| `marys-well-arch` | well | Gerd Eichmann | CC BY-SA 4.0 | 2560x1707 | 25 / 85 / 166 / 262 | yes |
| `marys-well-square` | well | Dr. Avishai Teicher | CC BY 2.5 | 1920x1440 | 29 / 98 / 204 | |
| `marys-well-warm-light` | well | Kyle Taylor | CC BY 2.0 | 1920x1280 | 24 / 75 / 143 | |
| `souk-vaulted-alley` | oldcity | Adam Jones | CC BY-SA 2.0 | 1920x1280 | 20 / 71 / 154 | |
| `souk-arcade` | oldcity | Zairon | CC BY-SA 4.0 | 1920x1198 | 28 / 86 / 166 | |
| `old-city-green-doors` | oldcity | ישראל פרקר (Israel Parker) | CC BY 2.5 | 1920x1440 | 36 / 144 / 284 | |
| `old-city-arched-passage` | oldcity | ישראל פרקר (Israel Parker) | CC BY 2.5 | 2560x1920 | 43 / 157 / 322 / 492 | yes |
| `old-city-lights` | oldcity | ישראל פרקר (Israel Parker) | CC BY 2.5 | 1920x1198 | 26 / 103 / 223 | |
| `synagogue-church-altar` | synagogue | כובש המלפפונים | CC BY-SA 4.0 | 1920x1280 | 23 / 67 / 144 | |
| `synagogue-church-vault` | synagogue | שלמה רודד | CC BY 2.5 | 1920x1440 | 34 / 111 / 220 | |
| `synagogue-church-melkite-nave` | synagogue | israel zeller | CC BY 2.5 | 1920x1080 | 20 / 58 / 105 | |
| `precipice-olive-viewpoint` | precipice | Dr. Avishai Teicher | CC BY 2.5 | 1920x1440 | 29 / 98 / 203 | |
| `precipice-cliff` | precipice | Dr. Avishai Teicher | CC BY 2.5 | 1920x1440 | 26 / 93 / 202 | |
| `precipice-valley-pine` | precipice | ישראל פרקר (Israel Parker) | CC BY 2.5 | 1920x1046 | 35 / 155 / 328 | |
| `city-basilica-skyline` | city | Israel_photo_gallery | CC BY-SA 2.0 | 2560x1707 | 27 / 90 / 170 / 273 | yes |
| `city-churches-minaret` | city | רונן מרקוס | CC BY 2.5 | 1920x1440 | 22 / 64 / 122 | |
| `city-hills-galilee` | city | Neil Ward | CC BY 2.0 | 2560x1700 | 23 / 74 / 139 / 206 | yes |
| `city-sunset-glow` | city | Liran1977 | CC BY-SA 3.0 | 2560x1707 | 47 / 134 / 252 / 402 | yes |
| `city-snow` | city | Andrewfarah.a | CC BY-SA 4.0 | 1920x1080 | 24 / 73 / 134 | |

Authors are written exactly as Commons names them (some in Hebrew script, some are user names). The Hebrew
names are the photographers' own; they are not translated or transliterated so that the credit stays the
author's. Each row's source page, licence URL and the original file name are in `media.generated.ts`
(`sourceUrl`, `licenseUrl`, `file`).

## 2. What the licences require

* **Public domain / CC0**: nothing, but we credit anyway.
* **CC BY** (2.0, 2.5): name the author, name the licence, link to the licence and (best practice) to the
  source, and say if the photo was changed. We resize and crop the photos; that is a change that the licence
  allows, and the viewer, `/credits` and the structured data show the author and licence.
* **CC BY-SA** (2.0 to 4.0): the same, and an *adapted* photo (our resized or cropped files) must be shared
  under the same licence. That covers the photo files, **not** the website around them. Every photo's page
  lists its licence; anyone may take the files from `/credits` under that licence.

The credit is always in text next to the photo (viewer caption) or on `/credits`, which the footer links on every
page. If an author asks for a changed credit or removal, edit `sources.json` and run the build, or delete the entry.

## 3. How the photos were chosen

1. Searched Commons through its API (`action=query`, `generator=search` and `generator=categorymembers`, with
   `prop=imageinfo` and `iiprop=url|extmetadata|size|mime`) for each subject the owner named: the Basilica of the
   Annunciation, St. Joseph's Church, the Greek Orthodox Church of the Annunciation, Mary's Well, the Old City and
   souk, the Synagogue Church, Mount Precipice, city panoramas. Also walked the matching Commons categories
   (about 80 of them), so the search saw 2,800 file records, not only keyword hits.
2. Kept JPEGs with `LicenseShortName` of public domain, CC0, CC BY or CC BY-SA, a named author (public domain may be
   unnamed) and no `NonFree` flag. Anything NC, ND, "fair use", logos or with an unclear licence was dropped.
3. Of about 1,100 landscape files at 2,400 px or wider, about 320 were looked at on contact sheets. A photo had
   to be sharp, well lit, free of watermarks and not heavily HDR or distorted, with no identifiable person as
   its subject, and had to add something the others did not (a viewpoint, a light, a room).
4. The 40 were then rendered and looked at again at the size the site serves them; two were replaced after
   that review (a hazy dusk view, a dim souk hero).
5. The builder re-reads the licence of every file from the Commons API and **stops** if one is not allowed, so
   a file cannot reach the site by being added to `sources.json`.

## 4. Rejected candidates, and why

| Candidate | Why not |
|---|---|
| `Sina0413.jpg`, `Nazareth Synagogue Church.jpg`, `BeyazCami0406.jpg` (user Ori~) | The licence field says only "Attribution": no licence name or version, so the terms are unclear. Skipped, as the task requires. |
| PikiWiki files whose author is "Unknown author" (for example `127750`, `127752`, `127773`-`127779`) | CC BY needs a name to credit; Commons has none. The builder refuses such a file. |
| `مدينة الناصرة - Nazareth - נצרת.jpg` (blue-hour city) | A photographer's watermark is printed across the picture. |
| `Christmas in Nazareth 03.jpg` | Shows a Coca-Cola advertisement (brand, character). |
| `Church of the Annunciation (1).JPG` | A large political and extremist banner is the foreground of the frame. |
| `Nazareth Market (1).JPG` | A children's book with a cartoon character (someone else's copyright) is in the frame. |
| Close-ups of the modern mosaics and frescoes in the basilica and St. Joseph's (the "gifts of the nations", `...-28-Mosaiken...`, `...Oberkirche Bilder...`, the Holy Family painting) | The artwork is the subject, and modern works may still be under their artists' copyright (Commons relies on freedom of panorama). Wide views of the rooms are used instead. |
| Photos of a priest posing (`PikiWiki Israel 67289 a melakit greek church in nazareth.jpg`), a group of soldiers and a friar (`Christmas in Nazareth 30.jpg`), market sellers (`Nazerat market (1496808129).jpg`), a funeral procession | Identifiable people are the subject. Visitors who are small and incidental are in some of the chosen photos (the facade, the lower church). |
| Historic prints and scans (Matson Collection, Willem van de Poll CC0, Felix Bonfils, David Roberts, Wellcome) | Public domain or CC0, but 1850-1960 black and white or lithographs: they fight with the site's colour and would suit a future "history" page. |
| Portrait phone shots (for example Konrad Summers, 2988x5312) | The layouts are landscape. |
| Photos under about 1,900 px wide, and hazy valley views from Mount Precipice (`View from Mount Precipice 1-3.jpg`) | Not sharp enough at hero size, or flat light. |
| Heavily distorted wide-angle or strongly tone-mapped views | Look unnatural at full screen. |
| `Nazareth israel.jpg` (CC BY-SA 1.0) | Valid, but the building is not named and the licence version is very old. |
| Three records whose licence field reads only "No restrictions" | That is not a licence name; skipped. |

Nothing NC or ND appeared in the results (Commons does not host them), but the builder rejects them anyway.

## 5. How to add more photos

1. Find candidates: `node scripts/media/search.mjs "Mary's Well Nazareth" --min 2400` (or `--category
   "Category:Well of St. Mary"`) lists only JPEGs of that size whose Commons licence is allowed and that have a
   named author, with a link to each file page. Open the page, look at the photo, and skip it unless it is sharp
   and well lit, with no watermark, no brand and no identifiable person as its subject.
2. Add an entry to `web/scripts/media/sources.json`:
   ```json
   {
     "id": "marys-well-evening",
     "file": "Exact Commons file name.jpg",
     "topic": "well",
     "subject": "well",
     "alt": "One plain English sentence describing the photo",
     "focal": [50, 55],
     "hero": false,
     "og": false
   }
   ```
   `topic` is one of `basilica stjoseph greek well oldcity synagogue precipice city` and decides which holy-site
   page and which `/gallery` group the photo joins; `subject` is one of the phrases in `MEDIA_SUBJECTS`
   (`media-types.ts`) and becomes the translated alt text ("Mary's Well: the well, photo 3 of 10").
   `focal` is where the picture should stay centred when it is cropped, in percent from the left and the top.
   `hero: true` also builds a 2560 px file; `og: true` also builds a 1200x630 social card.
3. From `web/`: `npm run media:build`. It checks the licence, downloads the original from `upload.wikimedia.org`
   (only), writes the AVIF/WebP files and rewrites `media.generated.ts`. Originals stay outside the repository
   (`MEDIA_CACHE`, default `<repo>/.media-cache`, git-ignored); `--offline` rebuilds from the cache.
4. A new `subject` or `topic` needs a translation in all 14 `media` blocks (the unit test fails until it has one).
5. Look at it (`npm run build`, `npm start`, open `/gallery` and the holy-site page) and run the tests.
6. Every few months: `npm run media:verify` asks Commons again and fails if a file vanished or its licence or
   author changed.

To change a crop or colour, add a new id rather than overwriting an old file: the files are cached for a month.
Keep the total at or under 40 photos unless there is a reason (each is about 0.9 MB in the repository).

## 6. Using the photos in code

```tsx
import { getMedia } from '@/data/media';
import MediaPicture from '@/components/media/MediaPicture';

<MediaPicture item={getMedia('city-sunset-glow')} alt="" sizes="max(100vw, 1200px)" fill priority />
```

* `getMedia(id)` returns the typed item (`MediaItem`: id, topic, subject, English `alt`, `width`, `height`,
  `widths`, `blurDataURL`, `focal`, `credit`, `author`, `license`, `licenseUrl`, `sourceUrl`) and throws for an
  unknown id. Other helpers: `mediaByTopic`, `mediaFile`, `mediaSrcSet`, `mediaDefaultFile`, `mediaShareFile`,
  `mediaObjectPosition`.
* `MediaPicture` renders `<picture>` with AVIF then WebP sources in every width, the blur placeholder, and the
  focal-point crop. Pass `sizes` honestly. A photo that covers a box which is **taller than wide** (a hero on a
  phone) is cropped sideways, so it needs a wider file than the screen: use `max(100vw, 1200px)` for heroes.
* `mediaPhoto(id)` (in `data/places/places.ts`) turns an item into a place `Photo`; `PhotoImage`
  (`components/places`) shows either kind. The holy-site pages, the sites index, the cards and the lightbox
  already use it.
* The `Photo.src` of a licensed photo is its share image (`og.jpg` where built, else the 1280 px WebP), used for
  social cards and JSON-LD.
* Show a credit wherever a licensed photo is the point of the page (the viewer caption does it for galleries),
  and link `/credits` (the footer does).

## 7. Suggested placements for the home page and the other pages

For the UI/home work (the home components were not touched):

| Where | Photo ids |
|---|---|
| Home hero poster candidates (2560 px, 16:9-friendly crops) | `basilica-night-view` (best at night), `city-sunset-glow`, `city-basilica-skyline`, `basilica-facade`, `basilica-dome-palms` |
| Home sites carousel (cards, 640 px is enough) | latin: `basilica-dome-palms`, greek: `greek-church-porch`, Mary's Well: `marys-well-warm-light`, old city: `old-city-green-doors`, city: `city-churches-minaret` (these are already each place's `cover`; use `getPlace(slug).cover.media`) |
| Home story section | `basilica-courtyard-dusk`, `basilica-grotto-altar`, `greek-painted-vault` |
| Seasonal banners | spring `basilica-spring-flowers`, winter `city-snow`, night `basilica-night-front` |
| Candle page | `basilica-grotto-altar`, `greek-iconostasis` (an altar and an iconostasis suit the theme) |
| Donate page | `city-hills-galilee` |
| Shop / souvenirs | `souk-arcade`, `old-city-lights`, `souk-vaulted-alley` |
| Live page | `basilica-night-front` |
| Reviews page | `stjoseph-nave` |
| Virtual tour poster | `city-sunset-glow` or `old-city-arched-passage` (the tour page still uses the older city photo) |

Already applied in this change: the five holy-site pages (hero, card cover, gallery), the holy-sites index hero
(`city-sunset-glow`), the About hero (`city-hills-galilee`), `/gallery`, `/credits`.

## 8. Notes and open points

* The older photos in `public/images/{latin,greek,mary,old,nazareth}` are kept and follow the licensed ones in each
  gallery. Their origin and licence are not recorded in the repository, so they are not on `/credits`; the owner
  should confirm that they own them or add a source. Several are small (300 to 900 px wide) and look soft next to
  the new ones; replacing them with licensed or own photos would lift the galleries further.
* Hebrew author names appear as written on Commons, in every language.
* The builder needs network access only to `commons.wikimedia.org` and `upload.wikimedia.org`.
* Sharp (used for resizing) ships with Next.js; no dependency was added.
