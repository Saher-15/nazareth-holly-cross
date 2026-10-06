# Legal review needed before launch

The pages `/privacy`, `/terms` and `/shipping-returns` were written by an AI agent from facts in the code. They are
deliberately conservative, but they are **not legal advice** and must be read by the owner and, ideally, a lawyer
before the new site replaces the old one. Texts live in `web/src/messages/<locale>.json` under `pilgrim.legal.*`
(14 languages, machine-made: native-speaker review needed too). Update `LEGAL_UPDATED` in
`web/src/components/pilgrim/LegalDocument.tsx` with every change.

## Decisions only the owner can make

- [ ] **Return window.** The page promises to "put right" damaged, wrong or missing items but names no number of days
      and no rule for ordinary change-of-mind returns. Decide the policy (e.g. N days, who pays return postage) and
      add it to `shipping.sections.returns`.
- [ ] **Delivery times.** None are stated because the code holds none. Add typical times per region if known.
- [ ] **Legal entity.** Name, registered address and registration number of "Nazareth Holy Cross" are not in the
      repository. Most jurisdictions (EU, UK, Israel) expect them on a privacy policy and a seller's terms.
- [ ] **Governing law and jurisdiction** are intentionally absent from the terms.
- [ ] **WhatsApp number** for the contact page: set `NEXT_PUBLIC_WHATSAPP` (digits with country code). The link only
      shows when it is set.

## Privacy policy: check against reality

- [ ] Data kept (from the models in `server/model`): orders (name, e-mail, phone, address, items, total, date),
      candle requests (name, e-mail, prayer), prayers (name, country, category, prayer, likes), reviews (name,
      place in the `email` field, message), contact messages (name, e-mail, phone, message).
- [ ] Retention is stated in general terms only. Choose real periods (accounting law usually fixes one for orders). A proposal per kind of data is in
      [DATABASE.md](DATABASE.md) section 7; nothing but audit entries (180 days) and sessions expires by itself.
- [ ] The payment record also keeps the **payer's name and e-mail as PayPal reports them**, and a donor's name (the `payment` collection); a candle request's prayer text can reveal religious belief
      (special-category data in the EU): the policy should say so and say how a person asks for erasure (owners use the dashboard's *Privacy requests* page, DATABASE.md section 8).
- [ ] A paid order that could not be saved yet is kept **in the customer's own browser** (localStorage, at most 30 days) until it is saved; say so in the policy.
- [ ] **Live broadcasts** (docs/LIVE.md): while a broadcast is live, `/live` shows Cloudflare Stream's player in a frame, so a
      visitor who watches it connects to Cloudflare (their address and browser reach Cloudflare, as with any video
      service). Name Cloudflare as a provider in the privacy policy, and say that live broadcasts are not recorded.
      People filmed in a church during a broadcast: decide whether a notice at the site is needed.
- [ ] Backups (docs/BACKUP.md) hold all personal data for 30 days; say how long erased data remains in them.
- [ ] "No advertising or analytics cookies": true today. Revisit the day analytics (roadmap item 5) is added; consent
      banner and policy text must change together.
- [ ] Processors named: PayPal, hosting (Netlify for the site, Render for the API, MongoDB Atlas, Firebase
      Storage). Confirm the list and where the data is stored; add transfer safeguards if EU/UK visitors are served.
- [ ] Browser storage listed: cart and wishlist (`nhc.cart.v1` and the wishlist), the prayers a visitor said Amen to
      (`nhc.prayers.liked.v1`) and the language cookie set by next-intl. Keep the list in step with the code.
- [ ] Data-subject requests are answered by e-mail only. Confirm someone owns that mailbox and a process exists to
      delete a prayer, review, order or candle request on request (there is no self-service and no admin UI for it
      in this repository except the admin site).
- [ ] Children: stated as "not aimed at under 13". Check the age that applies in the main markets.

## Terms of use

- [ ] Liability wording is generic. Have it checked for the markets served (consumer-law carve-outs differ).
- [ ] The prayer wall publishes prayers immediately and unmoderated (the API has no approval step for prayers, unlike
      reviews). Decide whether to add moderation; the terms reserve the right to remove content.
- [ ] Candle service: no delivery time is promised; confirm that matches what the team actually does.
- [ ] Donations: no refund rule is stated beyond "write to us if donated by mistake".

## Facts quoted on the pages (all come from code, keep in step)

| Fact | Source |
|---|---|
| Shipping flat $5 per order | `web/src/lib/pricing.ts`, `server/services/pricing.js` |
| 10% discount on items | same |
| Candle $3 | same |
| Donations $1 to $5,000 | `server/services/pricing.js` (copied into `web/src/data/pilgrim/faqEntries.ts`) |
| Payments by PayPal, prices computed by the server | `docs/ENGINEERING.md`, `server/services/pricing.js` |
| No accounts; cart and wishlist in the browser | `web/src/lib/cart.tsx`, `web/src/lib/shop` |
