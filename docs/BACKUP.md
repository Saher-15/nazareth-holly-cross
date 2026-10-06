# Backups: what is saved, how to restore, how to test it

MongoDB Atlas **M0 (the free tier) has no backups at all**: if the cluster is deleted, damaged, or someone runs a
wrong command, the orders, candle requests, messages, reviews, prayers, products, accounts and the payment ledger are
gone. This page is the replacement: a daily copy of the whole database to a folder you choose, a restore that has been
tested, and what to do about Atlas itself. Everything here is **read-only against the database** except the restore,
which writes only into an *empty* database.

| Piece | File | What it does |
|---|---|---|
| Backup | `server/scripts/backup.js` | Reads every collection and writes a dated folder (gzipped NDJSON + a manifest with counts and SHA-256). Never writes to the database. |
| Restore | `server/scripts/restore.js` | **Dry run by default.** Checks the backup, then (with `--apply`) restores into an **empty** database and verifies the counts. |
| Daily task (Windows) | `ops/backup-windows.ps1` | Runs the backup, keeps 30 days, logs, and never deletes anything when a backup failed. |
| After a restore | `server/scripts/ensure-indexes.js`, `check-data.js` | Confirm the indexes and the data ([DATABASE.md](DATABASE.md)). |

## 1. What is backed up

**Every collection**, with every document and every index definition (`manifest.json`):

`order`, `candle`, `contact`, `review`, `productReview`, `prayers`, `product`, `payment`, `admins`, `adminSession`,
`auditLog` (plus any collection that exists in the database but is unknown to the code; `check-data.js` names those).

Two consequences worth knowing:

* **The backup contains personal data and secrets**: customers' names, addresses, e-mails, phone numbers, prayer texts,
  and the admin accounts' password hashes and encrypted two-factor secrets. Keep the folder as private as the
  database itself: a disk only you can open, not a shared drive, not a public repository (**never** put dumps in the
  GitHub repository, it is public; there is deliberately no GitHub Action that stores them). If you copy backups to a cloud drive,
  use one with access limited to you, or encrypt the folder first (BitLocker on the disk, or a password-protected archive).
* A backup is a **copy at one moment**. Orders made after it are not in it. That is why it runs daily, and why the
  payment ledger and `scripts/reconcile-payments.js` matter: PayPal's own records and the ledger tell you which payments
  have no order after a restore.

Not in the backup (they live elsewhere): product photos (Firebase Storage), the website code (GitHub), settings and
secrets (Render and Netlify dashboards), PayPal's records (PayPal). Write down where each is; losing the Render secrets
(`JWT_SECRET` especially, which encrypts the two-factor secrets) is a separate disaster the backup cannot fix.

### The folder

```
D:\NHC-Backups\
  nhc-backup-20261006-033000\          one folder per backup (UTC time)
    manifest.json                      database name, time, per collection: file, documents, bytes, SHA-256, indexes
    order.ndjson.gz                    one MongoDB Extended JSON document per line, gzipped (exact types kept)
    candle.ndjson.gz  ...              one file per collection
  backup.log                           what each run did (no secrets)
  LAST_OK.txt  or  LAST_FAILED.txt     the result of the latest run, readable at a glance
```

A folder is written as `*.partial` and renamed only after **every file was read back and matched its checksum and
count**, so a folder that exists under its final name is a complete, verified backup.

## 2. Make the daily backup run (Windows)

You need: this repository on the PC, Node.js 20+, and `npm ci` run once inside `server/`.

1. **Store the database address once, encrypted.** In PowerShell, from the repository folder:

   ```powershell
   .\ops\backup-windows.ps1 -Setup
   ```

   It asks for the MongoDB connection string (Atlas: *Connect* -> *Drivers*; use a **read-only** database user, see
   section 7). The input is hidden and the answer is stored with Windows DPAPI in
   `%USERPROFILE%\.nhc-backup\database-url.dpapi`: only **your** Windows user on **this** PC can decrypt it, and the
   file does not contain the address in readable form. The address is never an argument and never printed.

2. **Run one backup by hand** and look at the result:

   ```powershell
   .\ops\backup-windows.ps1 -BackupFolder D:\NHC-Backups
   ```

   It prints the host and database name (check it is the production one) and `OK nhc-backup-...`. Open the folder: you
   should see the dated folder, `backup.log` and `LAST_OK.txt`.

3. **Schedule it daily**:

   ```powershell
   .\ops\backup-windows.ps1 -BackupFolder D:\NHC-Backups -Register -At 03:30
   Start-ScheduledTask -TaskName "NHC MongoDB Backup"     # try it now; then read backup.log
   ```

   The task is "Run only when the user is logged on" (logon type *Interactive*, the same as your other tasks on this
   PC), starts as soon as possible if the PC was off at 03:30 (*StartWhenAvailable*), and stops after two hours. **Why
   signed in, not "whether the user is logged on or not" (S4U):** the encrypted address can only be opened with your
   signed-in profile; a task that runs signed out cannot decrypt it and fails with a clear message. The trade-off: the PC
   must be on and you signed in sometime during the day. If you want it to run without you signed in, put the
   backup on a small always-on machine or a server instead (the script is the same; run `-Setup` there).

4. **Rotation.** After a *successful* backup the script removes backup folders older than 30 days (`-KeepDays`), but never
   fewer than 7 remain (`-KeepAtLeast`), never touches a folder without a manifest, and removes leftover `.partial`
   folders older than two days. A failed backup deletes **nothing**.

5. **Check it sometimes.** Look at `LAST_OK.txt` (should be today or yesterday) once a week, or whenever the PC has been
   off. `LAST_FAILED.txt` appearing means the latest run failed: `backup.log` says why (wrong address, no
   network, Atlas down, disk full). Task Scheduler's "Last Run Result" shows `0x1` for a failure too.

To stop: `.\ops\backup-windows.ps1 -Unregister`. To change the address (a rotated database password): run `-Setup` again.

Running it by hand without the PowerShell script, on any system: `cd server; DATABASEURL=... node scripts/backup.js --out <folder>`
(the address from the environment or a hidden prompt, never an argument).

## 3. Restore, step by step

A restore **only goes into an empty database.** It refuses anything else, so it can never overwrite or mix into live
data. To recover, restore into a **new, empty database**, check it, then point the API at it.

1. **Pick the backup**: the newest folder that has `manifest.json` (and is not `*.partial`). Check its date: orders made
   since are not in it.
2. **Create the target**: in Atlas, a new database (or a new free cluster) with a database user that may write. Take its
   connection string. Never use the production one for a *test* restore.
3. **Dry run** (writes nothing; verifies every checksum and count of the backup and that the target is empty):

   ```powershell
   cd server
   $env:DATABASEURL = "<the NEW database's connection string>"      # or leave it unset and type it when asked
   node scripts/restore.js --from D:\NHC-Backups\nhc-backup-20261006-033000
   ```

   It prints the host and database name of the target. **Read them.** It ends with `DRY RUN: nothing was written`. If it
   says the backup is damaged, use the previous day's folder.
4. **Restore for real**:

   ```powershell
   node scripts/restore.js --from D:\NHC-Backups\nhc-backup-20261006-033000 --apply
   ```

   It writes the documents in batches, creates the recorded indexes, then compares the number of documents in every
   collection with the manifest, and says `Restored. Every collection has exactly the number of documents the backup recorded.`
   If it stops half-way (network), delete the half-filled target database and run it again: it will not continue into a
   non-empty one.
5. **Check it**:

   ```powershell
   node scripts/ensure-indexes.js        # dry run: should say every index exists
   node scripts/check-data.js            # structural check of the restored data
   node scripts/reconcile-payments.js    # payments without an order, since the backup
   ```
6. **Point the API at it**: Render -> the API service -> Environment -> `DATABASEURL` = the new connection string ->
   redeploy. Open `/health` (`database: up`), sign in to the dashboard, look at Orders and Payments.
7. **Fill the gap**: orders and candle requests made *between the backup and the loss* are not in the backup. Look in
   PayPal for payments after the backup time and in the customers' confirmation e-mails (your mailbox), and enter what is
   missing by hand. Erasure requests (GDPR) made after the backup must be **done again** on the restored data (docs/DATABASE.md,
   "Erasing a customer").

## 4. Test a restore (do this once now, then every few months)

A backup you have never restored is a hope, not a backup. Test without touching production:

1. In Atlas create a **second free cluster** (or just a new empty database on the same cluster) named `nhc-restore-test`.
2. Run steps 2-5 above against it, with the newest backup.
3. Compare: the dashboard numbers of the test (point a **local** API at it: `server/.env` with the test address, `npm run dev`,
   and the admin dashboard locally), or just the counts printed by the restore, against Atlas' *Collections* view of production.
4. Delete the test database. Write down the date you tested.

The same dry run (`node scripts/restore.js --from <folder>` with an empty/unused target address, or any address: it
refuses nothing in dry run except a damaged backup or a non-empty target) is a quick way to **verify a backup is
intact** without writing anything.

The code is tested against an in-memory stand-in for the MongoDB driver (server/__tests__/ops-backup-restore.test.js:
every document and index restored exactly, damaged files refused, non-empty target refused, no address in any output).
**It has not been run against a real Atlas cluster**: the first real test restore (step 4) is how you find out.

## 5. Atlas options (you pick; none is assumed)

| Option | Cost | What you get | Notes |
|---|---|---|---|
| **This backup only** (M0) | free | A daily copy on your PC, 30 days | Depends on the PC being on and signed in. Keep a second copy elsewhere (an external disk, a private cloud drive). |
| **Atlas M2/M5** (shared, paid) | from about $9 / month | Cloud backup snapshots (a daily snapshot, short retention) and 2 GB+ storage | Check current Atlas pricing and what the snapshot retention is; restore from the Atlas UI. |
| **Atlas M10+** (dedicated) | from about $57 / month | Continuous cloud backup with point-in-time restore, snapshot schedule you control, monitoring and alerts | The right tier if the shop grows. |
| **Cloud snapshots to another region / download** | on paid tiers | Atlas can copy snapshots to another region; a snapshot can be downloaded | Useful against a provider incident. |

Upgrading from M0 to M2/M5 is done in place in the Atlas UI (*Edit configuration*) and keeps the connection string. Prices
change: confirm on the Atlas pricing page before deciding. **Even with paid snapshots, keep this script**: a copy you hold
yourself is independent of one account and one provider, and it is the only thing that works if the Atlas account is lost.

## 6. If the backup fails

| `backup.log` says | Cause | Fix |
|---|---|---|
| `The database address is not stored yet` | `-Setup` was never run (or by another Windows user) | Run `-Setup` as the user whose task it is. |
| `cannot be decrypted` | The task runs as another user, or signed out, or the profile changed | The task must run as you, signed in (`-Register` does this). Run `-Setup` again. |
| `Node.js was not found` | `node` is not on the PATH of the task | Install Node, or run the task as the user who has it. |
| `Backup FAILED: ... getaddrinfo ... / ECONNREFUSED / timed out` | No network, or Atlas' IP access list does not allow this PC | Atlas -> Network Access: allow this PC's address (or "current IP"); check the connection. |
| `Authentication failed` | The database password was rotated | New connection string, `-Setup` again. |
| `The backup failed its own check` | A file was damaged while writing (disk) | Free disk space, run again. Nothing was published. |

## 7. Limits and risks

* **One PC.** If it is off for days there are no new backups; the log shows the gap. A second copy (cloud drive, external
  disk) protects against the PC dying.
* **Use a read-only database user** for the backup's address (Atlas -> Database Access -> a user with the `read` role on
  your database). Then even a bug or a stolen file of this setup cannot change the data. The restore needs a user that can write,
  and uses a *different* address, typed or set only while restoring.
* **The address on disk.** DPAPI protects it from other users and other PCs, not from malware running as you. Hence the read-only user.
* **Size**: the backup streams one document at a time (constant memory). A free cluster (512 MB at most) backs up in seconds to
  a few minutes; the folders are small (the data compresses well). See docs/DATABASE.md for expected sizes.
* **No encryption** of the files themselves: protect the folder (section 1).
