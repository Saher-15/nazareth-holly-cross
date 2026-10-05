# Security policy

## Reporting a vulnerability

If you think you have found a security problem in the Nazareth Holy Cross website (nazarethholycross.com),
its API or its admin site, **please tell us privately first** and give us a chance to fix it before it is
made public.

- **Preferred:** use GitHub's private reporting: the repository's **Security** tab, **Report a vulnerability**.
- **Or e-mail:** nazarethholycross@gmail.com with the subject line "Security report".

Please include what you found, where (a URL or an API route), the steps to reproduce it, and what an attacker
could do with it. A screenshot or a short video helps. Please do **not** include other people's personal data
in the report; a description of how to reach it is enough.

What you can expect from us:

- an answer within **3 working days** saying we received it;
- a first assessment (is it real, how serious) within **7 days**;
- a fix, or a clear plan and date, as soon as we can, and a note to you when it is live;
- credit in the fix notes if you want it.

### Please do

- test only with your own data and your own orders: use the PayPal **sandbox**, never a real card;
- stop as soon as you have shown the problem exists; do not download, change or delete data that is not yours;
- keep the details private until we have fixed it.

### Please do not

- run automated scans that flood the site (the API runs on a small free plan and will fall over);
- try to read other visitors' orders, messages or prayers, or send spam through the contact and candle forms;
- test denial-of-service attacks, social engineering of the owners, or physical attacks.

We will not take legal action against anyone who follows this policy in good faith.

## What is covered

| In scope | Examples |
|---|---|
| The website `nazarethholycross.com` and its Netlify previews | cross-site scripting, broken access control, open redirects |
| The API `nazareth-holy-cross-api.onrender.com` | injection, authentication bypass, paying less than the price, reading admin data |
| The admin site | anything that lets a visitor act as an administrator |

Out of scope: problems in PayPal, Firebase, Netlify, Render, MongoDB Atlas or Google themselves (report those to
the vendor); missing "best practice" headers with no demonstrated impact; reports from automated scanners without a
working proof; the older site in `client/` once it is retired.

## Supported versions

Only what is live at nazarethholycross.com (the `main` branch) is supported.

## How we work

How the site is protected, the threat model and the open items are written in
[docs/SECURITY.md](docs/SECURITY.md). Secrets live only in Render and Netlify settings, never in the
repository; every pull request is scanned for committed secrets and vulnerable dependencies
(`.github/workflows/security.yml`).
