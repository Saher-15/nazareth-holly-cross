# Firebase Storage (product photos and videos)

The bucket `nazareth-holy-cross.appspot.com` holds the product photos and the long videos. Its rules and CORS settings
used to live only in the old repository `Saher-15/nazareth-holly-cross-client`. These are **copies of what that
repository held on 2026-10-06**, kept here so archiving the old repository loses nothing.

**What is deployed in the Firebase console was NOT checked** (no access from the audit). Compare it with these files
before trusting either one: Firebase console -> Storage -> Rules, and `gsutil cors get gs://<bucket>`.

| File | Meaning | To apply |
|---|---|---|
| `storage.rules` | anyone may read; any *signed-in Firebase user* may write | `firebase deploy --only storage` (Firebase CLI, in this folder with a `firebase.json`) |
| `cors.json` | any origin may GET/HEAD the files (needed by `next/image` and the browser) | `gsutil cors set cors.json gs://<bucket>` |

## What to tighten (docs/INFRASTRUCTURE.md section 6)

- "Signed-in" is only safe while **no sign-in method is enabled** in Firebase Authentication (Authentication -> Sign-in
  method: everything disabled, including Anonymous). If any is on, a stranger can create an account and upload to the
  bucket. The new admin dashboard uploads through its own API-side checks, not through these rules.
- Writes should be limited to images and videos with a size limit, for example
  `allow write: if request.auth != null && request.resource.size < 20 * 1024 * 1024 && request.resource.contentType.matches('image/.*|video/.*');`
- Reading stays public on purpose (the site shows the photos to everyone).
