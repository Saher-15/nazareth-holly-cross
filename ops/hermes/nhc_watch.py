#!/usr/bin/env python3
"""Watchdog for the LIVE Nazareth Holy Cross site, built to run as a Hermes Agent script-only cron job.

Read-only: GET requests and TLS handshakes only. Nothing is written to the site or the API, no form is sent, no
secret is needed or printed. Standard library only (Python 3.9+), so it runs on any machine that runs Hermes.

How Hermes uses it (docs/MONITORING.md, section 8):

    every 5 minutes   nhc_watch.py            prints NOTHING while all is well -> Hermes sends nothing
                                              prints an alert when a check fails twice in a row, a reminder
                                              while it stays down, and a "recovered" message when it is back
    every morning     nhc_summary.py          always prints a short status report, plus what changed since the
                                              previous report (merged PRs, deploy status, open PRs, shop changes)

Hermes delivers whatever the script prints to Telegram; empty output means silence. A crash or a non-zero exit is
delivered by Hermes as an error, so a broken watchdog cannot fail silently.

Manual use:

    python3 nhc_watch.py                 watchdog mode (as cron runs it)
    python3 nhc_watch.py --summary       full report, always prints
    python3 nhc_watch.py --verbose       watchdog mode, plus one line per check on stderr
    python3 nhc_watch.py --site URL --api URL --admin URL      other targets (a preview, local servers)

Environment (all optional): NHC_WATCH_STATE (state file, default: nhc-watch-state.json in the Hermes home folder),
NHC_WATCH_CONFIRM (failures in a row before alerting, default 2), NHC_WATCH_REMIND_MIN (minutes between "still down"
reminders, default 120).

Cost: two API requests per run (about 6 of the API's 200 per 15 minutes).
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

def _local_tz():
    """The owner's time zone for every time in a message (the Railway server runs on UTC). NHC_TZ overrides it."""
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(os.environ.get("NHC_TZ", "Asia/Jerusalem"))
    except Exception:  # no tz database on the machine: fall back to its own clock
        return None


LOCAL_TZ = _local_tz()

UA = "nhc-watch/1.0 (Hermes watchdog, read-only; docs/MONITORING.md)"
DOMAIN = "nazarethholycross.com"
DOMAIN_EXPIRY_FALLBACK = "2027-08-26"  # docs/MONITORING.md, used only when RDAP cannot be reached

# Thresholds (docs/MONITORING.md, section 3).
SLOW_PAGE_MS = 8000
DB_LATENCY_WARN_MS = 150
CERT_WARN_DAYS = 14
DOMAIN_WARN_DAYS = 30
RDAP_EVERY_S = 24 * 3600

# The first-line fix per check, shown in the alert (sections refer to docs/MONITORING.md).
RUNBOOK = {
    "site": "Netlify -> Deploys: is the last deploy green? Roll back with 'Publish deploy' on the previous one (MONITORING.md 5.1).",
    "shop": "If /en works but the shop fails, the API is the likely cause: check /health/deep (MONITORING.md 5.2, 5.4).",
    "sitemap": "The sitemap reads the API: check /health/deep, then Netlify function logs.",
    "api": "Railway -> divine-spontaneity -> nazareth-holy-cross-api -> Deployments and Logs. 503 = MongoDB unreachable: Atlas -> Network Access (MONITORING.md 5.2).",
    "catalog": "Railway -> the API service -> Logs; Atlas status (MONITORING.md 5.4).",
    "admin": "Netlify -> the admin site -> Deploys; a 404 on every page means the Next.js runtime plugin did not run (MONITORING.md 5.1).",
    "cert": "Netlify -> Domain management -> HTTPS -> Renew certificate.",
    "domain": "GoDaddy: renew the domain and turn auto-renew on.",
}


# ----------------------------------------------------------------------------------------------------------------------
# HTTP and TLS helpers
# ----------------------------------------------------------------------------------------------------------------------
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # a redirect is reported, not followed
        return None


def http_get(url: str, timeout: float, ctx: ssl.SSLContext | None, headers: dict | None = None) -> tuple[int, str, int]:
    """Returns (status, body, milliseconds). status 0 = no answer (network error or timeout)."""
    handlers = [NoRedirect()]
    if ctx is not None:
        handlers.append(urllib.request.HTTPSHandler(context=ctx))
    opener = urllib.request.build_opener(*handlers)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*", "Cache-Control": "no-cache", **(headers or {})})
    started = time.monotonic()
    try:
        with opener.open(req, timeout=timeout) as res:
            body = res.read(2_000_000).decode("utf-8", "replace")
            return res.status, body, int((time.monotonic() - started) * 1000)
    except urllib.error.HTTPError as err:
        body = err.read(200_000).decode("utf-8", "replace") if err.fp else ""
        return err.code, body, int((time.monotonic() - started) * 1000)
    except Exception as err:  # DNS, refused, timeout, TLS
        reason = getattr(err, "reason", err)
        return 0, f"{type(reason).__name__}: {reason}", int((time.monotonic() - started) * 1000)


def cert_days_left(host: str, port: int, timeout: float, ctx: ssl.SSLContext) -> float:
    with socket.create_connection((host, port), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as tls:
            not_after = tls.getpeercert()["notAfter"]
    expires = ssl.cert_time_to_seconds(not_after)
    return (expires - time.time()) / 86400


# ----------------------------------------------------------------------------------------------------------------------
# Checks. Each returns {"ok": bool, "detail": str, "metrics": {...}}.
# ----------------------------------------------------------------------------------------------------------------------
def page_check(url: str, keyword: str | None, timeout: float, ctx) -> dict:
    status, body, ms = http_get(url, timeout, ctx)
    metrics = {"ms": ms, "status": status}
    if status == 0:
        return {"ok": False, "detail": f"no answer ({body[:120]})", "metrics": metrics}
    if status != 200:
        return {"ok": False, "detail": f"HTTP {status} in {ms} ms", "metrics": metrics}
    if keyword and keyword not in body:
        return {"ok": False, "detail": f"HTTP 200 but the page does not contain '{keyword}'", "metrics": metrics}
    if ms > SLOW_PAGE_MS:
        return {"ok": False, "detail": f"very slow: {ms / 1000:.1f} s", "metrics": metrics}
    return {"ok": True, "detail": f"{ms} ms", "metrics": metrics}


def api_deep_check(api: str, timeout: float, ctx) -> dict:
    status, body, ms = http_get(f"{api}/health/deep", timeout, ctx)
    metrics = {"ms": ms, "status": status}
    if status == 0:
        return {"ok": False, "detail": f"no answer ({body[:120]})", "metrics": metrics}
    try:
        data = json.loads(body)
    except ValueError:
        data = {}
    db = data.get("database") if isinstance(data.get("database"), dict) else {}
    metrics.update({
        "dbLatencyMs": db.get("latencyMs"),
        "dbState": db.get("state"),
        "uptimeSeconds": data.get("uptimeSeconds"),
        "version": data.get("version"),
        "commit": data.get("commit"),
        "paypalMode": data.get("paypalMode"),
    })
    if status == 503:
        return {"ok": False, "detail": f"the API cannot reach MongoDB (503, state={db.get('state', '?')})", "metrics": metrics}
    if status != 200 or data.get("status") != "ok":
        return {"ok": False, "detail": f"HTTP {status}, status={data.get('status', '?')}", "metrics": metrics}
    return {"ok": True, "detail": f"{ms} ms, database {db.get('latencyMs', '?')} ms", "metrics": metrics}


def cert_check(hosts: list[str], timeout: float, ctx) -> dict:
    worst_host, worst = None, None
    errors = []
    for host in hosts:
        try:
            days = cert_days_left(host, 443, timeout, ctx)
        except Exception as err:
            errors.append(f"{host}: {type(err).__name__}")
            continue
        if worst is None or days < worst:
            worst_host, worst = host, days
    metrics = {"minDays": None if worst is None else round(worst, 1), "host": worst_host}
    if errors and worst is None:
        # Every handshake failed: the page checks report the outage; do not double-alert here.
        return {"ok": True, "detail": "not measured (" + "; ".join(errors) + ")", "metrics": metrics, "unknown": True}
    if worst is not None and worst < CERT_WARN_DAYS:
        return {"ok": False, "detail": f"certificate of {worst_host} ends in {worst:.0f} days", "metrics": metrics}
    return {"ok": True, "detail": f"{worst:.0f} days left (lowest: {worst_host})", "metrics": metrics}


def domain_check(state: dict, timeout: float, ctx, now: float) -> dict:
    cached = state.get("domain", {})
    expiry = cached.get("expiry")
    source = cached.get("source", "cache")
    if not expiry or now - cached.get("checkedAt", 0) > RDAP_EVERY_S:
        status, body, _ = http_get(f"https://rdap.verisign.com/com/v1/domain/{DOMAIN}", timeout, ctx)
        found = None
        if status == 200:
            try:
                for event in json.loads(body).get("events", []):
                    if event.get("eventAction") == "expiration":
                        found = event.get("eventDate", "")[:10]
            except ValueError:
                pass
        if found:
            expiry, source = found, "RDAP"
            state["domain"] = {"expiry": expiry, "checkedAt": now, "source": source}
        elif not expiry:
            expiry, source = DOMAIN_EXPIRY_FALLBACK, "docs"
    days = (datetime.fromisoformat(expiry).replace(tzinfo=timezone.utc).timestamp() - now) / 86400
    metrics = {"expiry": expiry, "days": round(days), "source": source}
    if days < DOMAIN_WARN_DAYS:
        return {"ok": False, "detail": f"{DOMAIN} expires on {expiry} ({days:.0f} days)", "metrics": metrics}
    return {"ok": True, "detail": f"expires {expiry} ({days:.0f} days)", "metrics": metrics}


def internet_ok(timeout: float, ctx) -> bool:
    """A control request to unrelated sites: if the watcher itself is offline, it must not report the site as down."""
    for url in ("https://www.google.com/generate_204", "https://cloudflare.com/cdn-cgi/trace"):
        status, _, _ = http_get(url, timeout, ctx)
        if status:
            return True
    return False


# ----------------------------------------------------------------------------------------------------------------------
# State, alert logic, messages
# ----------------------------------------------------------------------------------------------------------------------
LABELS = {
    "site": "Website (/en)",
    "shop": "Shop page",
    "sitemap": "Sitemap",
    "api": "API + database",
    "catalog": "Product catalog API",
    "admin": "Admin dashboard",
    "cert": "TLS certificates",
    "domain": "Domain registration",
}


def default_state_path() -> Path:
    """Next to the script when it runs from Hermes' scripts folder (Windows: %LOCALAPPDATA%\\hermes\\scripts),
    so the counters live in the Hermes home on every platform; HERMES_HOME wins when it is set."""
    if os.environ.get("HERMES_HOME"):
        return Path(os.environ["HERMES_HOME"]) / "nhc-watch-state.json"
    here = Path(__file__).resolve().parent
    if here.name == "scripts":
        return here.parent / "nhc-watch-state.json"
    return Path.home() / ".hermes" / "nhc-watch-state.json"


def load_state(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def fmt_duration(seconds: float) -> str:
    minutes = int(seconds // 60)
    if minutes < 60:
        return f"{minutes} min"
    hours, minutes = divmod(minutes, 60)
    if hours < 48:
        return f"{hours} h {minutes} min"
    return f"{hours // 24} days"


def evaluate(results: dict, state: dict, now: float, confirm: int, remind_s: float) -> list[str]:
    """Updates state["checks"] in place and returns the alert lines to send (empty = stay silent)."""
    checks = state.setdefault("checks", {})
    down, still, recovered, notes = [], [], [], []
    for name, result in results.items():
        if result.get("unknown"):
            continue
        prev = checks.get(name, {})
        entry = {"failures": 0, "alerted": False, "since": None, "lastAlert": None}
        entry.update(prev)
        if result["ok"]:
            if entry["alerted"]:
                recovered.append(f"✅ {LABELS[name]} is back ({result['detail']}), down for {fmt_duration(now - entry['since'])}.")
            entry.update({"failures": 0, "alerted": False, "since": None, "lastAlert": None})
        else:
            entry["failures"] += 1
            if entry["since"] is None:
                entry["since"] = now
            if not entry["alerted"] and entry["failures"] >= confirm:
                down.append(f"🔴 {LABELS[name]}: {result['detail']}\n   → {RUNBOOK[name]}")
                entry.update({"alerted": True, "lastAlert": now})
            elif entry["alerted"] and now - (entry["lastAlert"] or 0) >= remind_s:
                still.append(f"⏳ {LABELS[name]} still failing for {fmt_duration(now - entry['since'])}: {result['detail']}")
                entry["lastAlert"] = now
        entry["detail"] = result["detail"]
        checks[name] = entry

    # Informational: the API restarted without the watcher seeing it go down (crash, sleep or deploy).
    api = results.get("api", {}).get("metrics", {})
    uptime, last_uptime, last_run = api.get("uptimeSeconds"), state.get("apiUptime"), state.get("lastRun")
    if isinstance(uptime, (int, float)):
        if isinstance(last_uptime, (int, float)) and last_run and uptime + 30 < last_uptime + (now - last_run):
            before, after = state.get("apiCommit"), api.get("commit")
            if before and after and before == after:  # same known commit: not a deploy
                notes.append(f"ℹ️ The API restarted {fmt_duration(uptime)} ago without a new deploy (crash, or a restart in Railway): Railway -> the API service -> Deployments and Logs.")
            elif not (before and after):  # the API does not report its commit: a deploy cannot be told apart from a crash
                notes.append(f"ℹ️ The API restarted {fmt_duration(uptime)} ago (a deploy or a crash): Railway -> the API service -> Deployments.")
        state["apiUptime"], state["apiCommit"] = uptime, api.get("commit")
    db_ms = api.get("dbLatencyMs")
    if isinstance(db_ms, (int, float)) and db_ms > DB_LATENCY_WARN_MS:
        if not state.get("dbSlowAlerted"):
            notes.append(f"🟠 Database latency is {db_ms} ms (normal: under {DB_LATENCY_WARN_MS}): Railway (EU West) and Atlas may be in different regions (INFRASTRUCTURE.md 2.4).")
            state["dbSlowAlerted"] = True
    elif isinstance(db_ms, (int, float)):
        state["dbSlowAlerted"] = False

    lines = []
    if down:
        lines.append("Nazareth Holy Cross: problem detected")
        lines += down
    if still:
        lines += still
    if recovered:
        lines += recovered
    lines += notes
    return lines


HISTORY_S = 24 * 3600


def record_run(results: dict, messages: list[str], state: dict, now: float) -> None:
    """Keeps 24 hours of history for the daily report: which checks failed on each run, and every message sent."""
    failing = [n for n, r in results.items() if not r["ok"] and not r.get("unknown")]
    runs = [r for r in state.get("runs", []) if now - r[0] < HISTORY_S]
    runs.append([now, failing])
    events = [e for e in state.get("events", []) if now - e[0] < HISTORY_S]
    events += [[now, m] for m in messages if m != "Nazareth Holy Cross: problem detected"]
    state["runs"], state["events"] = runs, events[-50:]


def recap(state: dict, now: float) -> list[str]:
    runs = [r for r in state.get("runs", []) if now - r[0] < HISTORY_S]
    events = [e for e in state.get("events", []) if now - e[0] < HISTORY_S]
    if len(runs) < 2:
        return ["", "Last 24 h: not enough watchdog runs yet to report on."]
    span = fmt_duration(now - runs[0][0])
    lines = ["", f"Last {span}: {len(runs)} checks run"]
    failed = {}
    for _, names in runs:
        for n in names:
            failed[n] = failed.get(n, 0) + 1
    if not failed and not events:
        lines.append("No incidents, everything stayed up ✅")
        return lines
    for n, count in sorted(failed.items(), key=lambda kv: -kv[1]):
        lines.append(f"· {LABELS.get(n, n)}: failed {count} of {len(runs)} checks ({100 * (1 - count / len(runs)):.1f}% up)")
    if events:
        lines.append("What happened:")
        for ts, msg in events[-15:]:
            first = msg.splitlines()[0]
            lines.append(f"  {datetime.fromtimestamp(ts).astimezone(LOCAL_TZ).strftime('%H:%M')}  {first}")
    return lines


# ----------------------------------------------------------------------------------------------------------------------
# "What changed" for the morning report: the code (GitHub) and the shop (public catalog), since the previous report.
# Read-only and public: no customer data is read. Each part fails on its own without breaking the report.
# ----------------------------------------------------------------------------------------------------------------------
GITHUB_REPO = "Saher-15/nazareth-holly-cross"
GITHUB_API = "https://api.github.com"
RAILWAY_STATUS_PREFIX = "divine-spontaneity - "  # Railway's commit status for the production API
MAX_LISTED = 8


def github_get(path: str, timeout: float, ctx):
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    status, body, _ = http_get(f"{GITHUB_API}{path}", timeout, ctx, headers)
    if status != 200:
        raise RuntimeError(f"GitHub HTTP {status}")
    return json.loads(body)


def code_changes(since: float, timeout: float, ctx) -> list[str]:
    pulls = github_get(f"/repos/{GITHUB_REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=50", timeout, ctx)
    merged = [p for p in pulls if p.get("merged_at") and (iso_to_ts(p["merged_at"]) or 0) > since]
    merged.sort(key=lambda p: p["merged_at"])
    open_prs = github_get(f"/repos/{GITHUB_REPO}/pulls?state=open&per_page=50", timeout, ctx)
    lines = []
    if merged:
        lines.append(f"🚀 Published to the live site ({len(merged)}):")
        if len(merged) > MAX_LISTED:
            lines.append(f"  … {len(merged) - MAX_LISTED} earlier ones not listed")
        for p in merged[-MAX_LISTED:]:
            when = datetime.fromtimestamp(iso_to_ts(p["merged_at"])).astimezone(LOCAL_TZ).strftime("%d/%m %H:%M")
            lines.append(f"  #{p['number']} {p['title'][:70]} ({when})")
        sha = github_get(f"/repos/{GITHUB_REPO}/commits/main", timeout, ctx)["sha"]
        statuses = github_get(f"/repos/{GITHUB_REPO}/commits/{sha}/status", timeout, ctx).get("statuses", [])
        api = next((s for s in statuses if s.get("context", "").startswith(RAILWAY_STATUS_PREFIX)), None)
        if api:
            mark = {"success": "✅", "pending": "⏳"}.get(api.get("state"), "🔴")
            lines.append(f"  {mark} API deploy on Railway: {api.get('state')}")
        runs = github_get(f"/repos/{GITHUB_REPO}/commits/{sha}/check-runs?per_page=50", timeout, ctx).get("check_runs", [])
        failed = sorted({r["name"] for r in runs if r.get("conclusion") in ("failure", "timed_out", "cancelled")})
        if failed:
            lines.append("  🔴 Failing checks on main: " + ", ".join(failed)[:200])
    else:
        lines.append("🚀 Nothing new was published to the live site.")
    if open_prs:
        waiting = [p for p in open_prs if not p.get("draft")]
        lines.append(f"📝 Open changes waiting for review: {len(waiting)}")
        for p in waiting[:MAX_LISTED]:
            lines.append(f"  #{p['number']} {p['title'][:70]}")
        if len(waiting) > MAX_LISTED:
            lines.append(f"  … and {len(waiting) - MAX_LISTED} more")
    return lines


def _digest(value) -> str:
    import hashlib
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


def catalog_snapshot(api: str, timeout: float, ctx) -> dict:
    status, body, _ = http_get(f"{api}/product/catalog", timeout, ctx)
    if status != 200:
        raise RuntimeError(f"catalog HTTP {status}")
    products = json.loads(body).get("products", [])
    snap = {}
    for p in products:
        if not isinstance(p, dict) or not p.get("_id"):
            continue
        rating = p.get("rating") if isinstance(p.get("rating"), dict) else {}
        snap[p["_id"]] = {
            "name": p.get("name") or "?",
            "price": p.get("price"),
            "stock": p.get("stock"),
            "category": p.get("category"),
            "sold": p.get("sold") or 0,
            "reviews": rating.get("count") or 0,
            "photos": _digest([p.get("img"), p.get("additionalImageUrls")]),
            "text": _digest([p.get("description"), p.get("materials"), p.get("color")]),
        }
    return snap


def shop_changes(old: dict, new: dict) -> list[str]:
    lines = []
    added = [new[i]["name"] for i in new if i not in old]
    removed = [old[i]["name"] for i in old if i not in new]
    if added:
        lines.append(f"🆕 New products ({len(added)}): " + ", ".join(added[:MAX_LISTED]))
    if removed:
        lines.append(f"🗑️ Removed products ({len(removed)}): " + ", ".join(removed[:MAX_LISTED]))
    edits, sold, reviews = [], 0, 0
    for i in new.keys() & old.keys():
        a, b = old[i], new[i]
        sold += max(0, (b["sold"] or 0) - (a["sold"] or 0))
        reviews += max(0, (b["reviews"] or 0) - (a["reviews"] or 0))
        what = []
        if a["price"] != b["price"]:
            what.append(f"price {a['price']} → {b['price']}")
        if a["stock"] != b["stock"]:
            what.append(f"stock {a['stock']} → {b['stock']}")
        if a["category"] != b["category"]:
            what.append(f"category {a['category']} → {b['category']}")
        if a["photos"] != b["photos"]:
            what.append("photos")
        if a["text"] != b["text"]:
            what.append("description")
        if a["name"] != b["name"]:
            what.append(f"renamed from \"{a['name']}\"")
        if what:
            edits.append(f"  {b['name']}: " + ", ".join(what))
    if edits:
        lines.append(f"✏️ Edited products ({len(edits)}):")
        lines += edits[:MAX_LISTED]
        if len(edits) > MAX_LISTED:
            lines.append(f"  … and {len(edits) - MAX_LISTED} more")
    if sold:
        lines.append(f"🛒 Items sold (shop counter): {sold}")
    if reviews:
        lines.append(f"⭐ New product reviews: {reviews}")
    if not lines:
        lines.append("🛍️ No changes in the shop.")
    return lines


def changes_report(state: dict, api: str, timeout: float, ctx, now: float) -> list[str]:
    """Called on the summary run only, so the five-minute watchdog never moves the baseline."""
    previous = state.get("report", {})
    since = previous.get("at") or (now - HISTORY_S)
    span = fmt_duration(now - since)
    lines = ["", f"What changed (last {span}):"]
    try:
        lines += code_changes(since, 30, ctx)
    except Exception as err:
        lines.append(f"⚪ Code changes not available ({type(err).__name__}: {str(err)[:80]})")
    try:
        snap = catalog_snapshot(api, timeout, ctx)
        if previous.get("catalog"):
            lines += shop_changes(previous["catalog"], snap)
        else:
            lines.append(f"🛍️ Shop: {len(snap)} products recorded; changes are reported from tomorrow.")
        state["report"] = {"at": now, "catalog": snap}
    except Exception as err:
        lines.append(f"⚪ Shop changes not available ({type(err).__name__}: {str(err)[:80]})")
        state.setdefault("report", {})["at"] = now
    return lines


# ----------------------------------------------------------------------------------------------------------------------
# Sales for the morning report, from GET /admin/dashboard with a VIEWER account (read-only; docs/ADMIN.md section 2).
# Only counts and amounts are used: the dashboard's `recent` lists (names, e-mails, prayers) are never read into a
# message. Off until NHC_VIEWER_USER and NHC_VIEWER_PASSWORD are set (Railway variables of the hermes service, or
# $HERMES_HOME/.env). The session is signed out at the end; a wrong password is reported, never retried.
# ----------------------------------------------------------------------------------------------------------------------
def _setting(name: str, state_path: Path) -> str | None:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    try:
        for line in (state_path.parent / ".env").read_text(encoding="utf-8").splitlines():
            key, sep, raw = line.partition("=")
            if sep and key.strip() == name:
                return raw.strip().strip("\"'") or None
    except OSError:
        pass
    return None


def api_json(method: str, url: str, timeout: float, ctx, body: dict | None = None, token: str | None = None):
    headers = {"User-Agent": UA, "Accept": "application/json", "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
    try:
        with opener.open(req, timeout=timeout) as res:
            raw = res.read(2_000_000).decode("utf-8", "replace")
            return res.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as err:
        return err.code, {}


def sales_report(api: str, state_path: Path, timeout: float, ctx, now: float) -> list[str]:
    user, password = _setting("NHC_VIEWER_USER", state_path), _setting("NHC_VIEWER_PASSWORD", state_path)
    if not user or not password:
        return []
    lines = ["", "Sales (yesterday):"]
    status, login = api_json("POST", f"{api}/admin/auth/login", timeout, ctx, {"username": user, "password": password})
    token = login.get("token") if status == 200 else None
    if not token:
        reason = {401: "wrong username or password, or the account is locked or disabled",
                  428: "the account has two-factor sign-in on: turn it off for this viewer account",
                  429: "too many sign-in attempts, try again later"}
        lines.append(f"⚪ Not available: sign-in refused ({reason.get(status, f'HTTP {status}')}). Check the Hermes viewer account.")
        return lines
    try:
        role = (login.get("user") or {}).get("role")
        if role != "viewer":  # never run the report with an account that can change or delete data
            lines.append(f"🔴 Not used: the Hermes account has role '{role}', it must be 'viewer'. Change it in the dashboard -> Users.")
            return lines
        status, dash = api_json("GET", f"{api}/admin/dashboard", timeout, ctx, token=token)
        if status != 200:
            lines.append(f"⚪ Not available: dashboard HTTP {status}.")
            return lines
        days = {d.get("date"): d for d in dash.get("last30Days", []) if isinstance(d, dict)}
        yesterday = (datetime.fromtimestamp(now).astimezone(LOCAL_TZ) - timedelta(days=1)).strftime("%Y-%m-%d")
        y = days.get(yesterday, {})
        week = [days.get((datetime.fromtimestamp(now).astimezone(LOCAL_TZ) - timedelta(days=i)).strftime("%Y-%m-%d"), {})
                for i in range(1, 8)]
        orders, revenue, candles = y.get("orders", 0), y.get("revenue", 0), y.get("candles", 0)
        lines.append(f"📦 Orders: {orders}  ·  💵 ${revenue:,.2f}  ·  🕯️ Candles: {candles}")
        w_orders, w_rev, w_candles = (sum(d.get(k, 0) for d in week) for k in ("orders", "revenue", "candles"))
        lines.append(f"   Last 7 days: {w_orders} orders, ${w_rev:,.2f}, {w_candles} candles")
        totals = dash.get("totals", {})
        todo = []
        if totals.get("ordersPending"):
            todo.append(f"{totals['ordersPending']} orders to ship")
        if totals.get("candlesPending"):
            todo.append(f"{totals['candlesPending']} candles to light")
        if totals.get("contactsOpen"):
            todo.append(f"{totals['contactsOpen']} messages to answer")
        if todo:
            lines.append("📋 Waiting in the dashboard: " + ", ".join(todo))
        unpaid = (dash.get("alerts") or {}).get("unfulfilledPayments") or {}
        if unpaid.get("count"):
            lines.append(f"🔴 Paid but not saved: {unpaid['count']} payment(s), ${unpaid.get('amount', 0):,.2f}. "
                         "Dashboard -> Payments (the customer paid and got nothing yet).")
        low = [f"{p.get('name')} ({p.get('stock')})" for p in dash.get("lowStock", [])[:MAX_LISTED] if isinstance(p, dict)]
        if low:
            lines.append("📉 Low stock: " + ", ".join(low))
    finally:
        api_json("POST", f"{api}/admin/auth/logout", timeout, ctx, {}, token=token)
    return lines


def summary(results: dict, state: dict) -> str:
    bad = [n for n, r in results.items() if not r["ok"]]
    stamp = datetime.now().astimezone(LOCAL_TZ).strftime("%a %d %b, %H:%M")
    head = f"Nazareth Holy Cross, daily status ({stamp})"
    head += "\nAll checks OK ✅" if not bad else f"\n{len(bad)} of {len(results)} checks failing 🔴"
    lines = [head]
    for name, r in results.items():
        mark = ("⚪" if r.get("unknown") else "✅") if r["ok"] else "🔴"
        lines.append(f"{mark} {LABELS[name]}: {r['detail']}")
    api = results.get("api", {}).get("metrics", {})
    extra = []
    if api.get("version") or api.get("commit"):
        extra.append(f"API version {api.get('version', '?')} {(api.get('commit') or '')[:7]}".strip())
    if isinstance(api.get("uptimeSeconds"), (int, float)):
        extra.append(f"up {fmt_duration(api['uptimeSeconds'])}")
    if api.get("paypalMode"):
        extra.append(f"PayPal mode: {api['paypalMode']}")
    if extra:
        lines.append("· " + " · ".join(extra))
    if api.get("paypalMode") == "sandbox":
        lines.append("⚠️ PayPal is still in sandbox mode: real payments are not taken.")
    lines += recap(state, time.time())
    return "\n".join(lines)


# ----------------------------------------------------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------------------------------------------------
def run_checks(site: str, api: str, admin: str, state: dict, timeout: float, ctx, now: float) -> dict:
    hosts = sorted({urlparse(u).hostname for u in (site, api, admin) if urlparse(u).scheme == "https"})
    results = {
        "site": page_check(f"{site}/en", "Nazareth", timeout, ctx),
        "shop": page_check(f"{site}/en/shop", "Shop", timeout, ctx),
        "sitemap": page_check(f"{site}/sitemap.xml", "<urlset", timeout, ctx),
        "api": api_deep_check(api, timeout, ctx),
        "catalog": page_check(f"{api}/product/catalog", "products", timeout, ctx),
        "admin": page_check(f"{admin}/login", None, timeout, ctx),
    }
    if hosts:
        results["cert"] = cert_check(hosts, 20, ctx)
    if urlparse(site).hostname == DOMAIN:
        results["domain"] = domain_check(state, 20, ctx, now)
    return results


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Read-only watchdog of the live site for Hermes Agent.")
    p.add_argument("--site", default="https://nazarethholycross.com")
    p.add_argument("--api", default="https://nazareth-holy-cross-api-production.up.railway.app")
    p.add_argument("--admin", default="https://admin.nazarethholycross.com")
    p.add_argument("--state", default=os.environ.get("NHC_WATCH_STATE", str(default_state_path())))
    p.add_argument("--summary", action="store_true", help="always print a full status report")
    p.add_argument("--verbose", action="store_true", help="one line per check on stderr")
    p.add_argument("--timeout", type=float, default=60, help="seconds per request")
    p.add_argument("--insecure-local", action="store_true", help=argparse.SUPPRESS)  # tests: self-signed local servers
    args = p.parse_args(argv)

    site, api, admin = (u.rstrip("/") for u in (args.site, args.api, args.admin))
    ctx = ssl.create_default_context()
    if args.insecure_local:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    confirm = max(1, int(os.environ.get("NHC_WATCH_CONFIRM", "2")))
    remind_s = max(5, int(os.environ.get("NHC_WATCH_REMIND_MIN", "120"))) * 60

    state_path = Path(args.state).expanduser()
    state = load_state(state_path)
    now = time.time()
    results = run_checks(site, api, admin, state, args.timeout, ctx, now)

    if args.verbose:
        for name, r in results.items():
            print(f"{'OK  ' if r['ok'] else 'FAIL'}  {name:8} {r['detail']}", file=sys.stderr)

    every_page_down = all(not results[n]["ok"] and results[n]["metrics"].get("status") == 0 for n in ("site", "api", "admin"))
    if every_page_down and not args.insecure_local and not internet_ok(15, ssl.create_default_context()):
        # The watcher is offline, not the site. Say nothing; the state is left untouched.
        if args.summary:
            print("Nazareth Holy Cross watchdog: this machine has no internet connection, nothing was checked.")
        return 0


    lines = evaluate(results, state, now, confirm, remind_s)
    record_run(results, lines, state, now)
    changes = changes_report(state, api, args.timeout, ctx, now) if args.summary else []
    if args.summary:
        try:
            changes += sales_report(api, state_path, args.timeout, ctx, now)
        except Exception as err:  # the sales part must never break the report
            changes += ["", f"⚪ Sales not available ({type(err).__name__})."]
    state["lastRun"] = now
    save_state(state_path, state)

    if args.summary:
        print(summary(results, state))
        if changes:
            print("\n".join(changes))
        if lines:  # an alert that falls on the summary run is not lost
            print("\n" + "\n".join(lines))
    elif lines:
        print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
