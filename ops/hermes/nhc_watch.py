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

Cost: two API requests per run (about 6 of the API's 200 per 15 minutes), which also keeps Render's free plan awake.
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
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

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
    "api": "Render -> the service -> Logs. 503 = MongoDB unreachable: Atlas -> Network Access (MONITORING.md 5.2).",
    "catalog": "Render logs; Atlas status (MONITORING.md 5.4).",
    "admin": "Netlify -> the admin site -> Deploys; a 404 on every page means the Next.js runtime plugin did not run (MONITORING.md 5.1).",
    "cert": "Netlify -> Domain management -> HTTPS -> Renew certificate.",
    "domain": "GoDaddy: renew the domain and turn auto-renew on.",
    "render": "Render dashboard -> the service: resume it, or fix billing (Account -> Billing).",
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


# ----------------------------------------------------------------------------------------------------------------------
# Render (optional): deploys, crashes and restarts read from the Render API with a read-only use of an API key.
# The key is never printed. Without a key this whole section is skipped.
# ----------------------------------------------------------------------------------------------------------------------
RENDER_SERVICE_ID = "srv-d9p3kiht0dsc73c77f4g"  # nazareth-holy-cross-api (docs/INFRASTRUCTURE.md)
RENDER_API = "https://api.render.com/v1"
RENDER_KEY_FILE = "nhc-render-key.txt"
DEPLOY_FAILED = {"build_failed", "update_failed", "pre_deploy_failed"}
DEPLOY_RUNNING = {"created", "queued", "build_in_progress", "update_in_progress", "pre_deploy_in_progress"}
STUCK_DEPLOY_S = 30 * 60
# Render event types worth a message, with the text shown. Deploy outcomes come from the deploys list instead.
RENDER_EVENTS = {
    "server_failed": "🔴 Render: the server failed (crashed). Render -> Logs.",
    "server_hardware_failure": "🔴 Render: hardware failure on the instance; Render moves it automatically.",
    "server_restarted": "🟠 Render: the server restarted.",
    "service_suspended": "🔴 Render: the service was SUSPENDED (billing, or suspended by hand). The site has no API.",
    "service_resumed": "✅ Render: the service was resumed.",
    "image_pull_failed": "🔴 Render: image pull failed.",
    "pipeline_minutes_exhausted": "🔴 Render: build pipeline minutes are used up; new deploys cannot build.",
    "service_disk_usage_high": "🟠 Render: disk usage is high.",
    "maintenance_started": "🟠 Render: platform maintenance started.",
    "maintenance_ended": "✅ Render: platform maintenance ended.",
    "plan_changed": "ℹ️ Render: the service plan was changed.",
    "auto_deploy_disabled": "🟠 Render: auto-deploy was turned OFF (merges to main will not deploy the API).",
    "auto_deploy_enabled": "ℹ️ Render: auto-deploy was turned on.",
    "branch_deleted": "🔴 Render: the deploy branch was deleted.",
}


def render_key(state_path: Path) -> str | None:
    key = os.environ.get("RENDER_API_KEY", "").strip()
    if key:
        return key
    try:
        key = (state_path.parent / RENDER_KEY_FILE).read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return key or None


def _unwrap(items, name):
    """The Render API lists items as [{"deploy": {...}, "cursor": ...}]; accept the bare shape as well."""
    out = []
    for item in items if isinstance(items, list) else []:
        if isinstance(item, dict):
            out.append(item.get(name) if isinstance(item.get(name), dict) else item)
    return out


def render_get(path: str, key: str, timeout: float, ctx):
    status, body, _ = http_get(f"{RENDER_API}{path}", timeout, ctx, {"Authorization": f"Bearer {key}", "Accept": "application/json"})
    try:
        data = json.loads(body) if status == 200 else None
    except ValueError:
        data = None
    return status, data


def iso_to_ts(value) -> float | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def short_commit(deploy: dict) -> str:
    commit = deploy.get("commit") if isinstance(deploy.get("commit"), dict) else {}
    cid = (commit.get("id") or "")[:7]
    msg = (commit.get("message") or "").strip().splitlines()[0][:70] if commit.get("message") else ""
    return f"{cid} {msg}".strip() or deploy.get("id", "?")


def render_check(key: str, state: dict, timeout: float, ctx, now: float) -> tuple[dict, list[str]]:
    """Returns (result for the summary/alert logic, one-off messages). Never raises."""
    r = state.setdefault("render", {})
    first_run = not r.get("initialised")
    messages: list[str] = []

    status, service = render_get(f"/services/{RENDER_SERVICE_ID}", key, timeout, ctx)
    if status in (401, 403):
        return {"ok": False, "detail": f"the Render API key was refused (HTTP {status}): create a new read key in Render -> Account settings -> API keys", "metrics": {"status": status}}, messages
    if status == 404:
        return {"ok": False, "detail": f"service {RENDER_SERVICE_ID} not found with this API key (wrong account or deleted)", "metrics": {"status": status}}, messages
    if status != 200 or not isinstance(service, dict):
        # The Render API itself is unreachable: not the site's problem, do not alert, show it in the summary only.
        return {"ok": True, "unknown": True, "detail": f"Render API not reachable (HTTP {status})", "metrics": {"status": status}}, messages

    name = service.get("name", RENDER_SERVICE_ID)
    suspended = service.get("suspended") == "suspended"
    metrics = {"status": 200, "name": name, "suspended": suspended,
               "autoDeploy": service.get("autoDeploy"), "branch": service.get("branch")}

    _, deploys = render_get(f"/services/{RENDER_SERVICE_ID}/deploys?limit=5", key, timeout, ctx)
    deploys = _unwrap(deploys, "deploy")
    latest = deploys[0] if deploys else {}
    dstatus = latest.get("status", "?")
    metrics.update(deployStatus=dstatus, deployId=latest.get("id"), deployCommit=short_commit(latest) if latest else None,
                   deployFinished=latest.get("finishedAt"))

    # Deploy transitions, one message per deploy and outcome.
    seen = r.setdefault("deploys", {})
    if not first_run:
        for d in reversed(deploys):
            did, st = d.get("id"), d.get("status")
            if not did or seen.get(did) == st:
                continue
            if st == "live":
                messages.append(f"🚀 Render: new API deploy is live ({short_commit(d)}). Run the post-deploy check: node ops/smoke-live.mjs")
            elif st in DEPLOY_FAILED:
                messages.append(f"🔴 Render: API deploy FAILED ({st}, {short_commit(d)}). The previous version keeps running. Render -> Events -> the deploy's logs.")
            elif st == "canceled" and seen.get(did) in DEPLOY_RUNNING:
                messages.append(f"🟠 Render: API deploy was canceled ({short_commit(d)}).")
    for d in deploys:
        if d.get("id"):
            seen[d["id"]] = d.get("status")
    for old in list(seen)[:-20]:
        seen.pop(old, None)

    # A deploy running for too long.
    started = iso_to_ts(latest.get("createdAt"))
    if dstatus in DEPLOY_RUNNING and started and now - started > STUCK_DEPLOY_S and r.get("stuckAlerted") != latest.get("id"):
        messages.append(f"🟠 Render: a deploy has been running for {fmt_duration(now - started)} ({dstatus}). Render -> Events.")
        r["stuckAlerted"] = latest.get("id")

    # Events since the last run (crashes, restarts, suspension, maintenance...).
    since = int(r.get("eventsSince") or (now - 3600))
    _, events = render_get(f"/services/{RENDER_SERVICE_ID}/events?limit=50&startTime={since}", key, timeout, ctx)
    seen_events = r.setdefault("events", [])
    newest = since
    for e in reversed(_unwrap(events, "event")):
        eid, etype = e.get("id"), e.get("type")
        ts = iso_to_ts(e.get("timestamp")) or now
        newest = max(newest, int(ts))
        if not eid or eid in seen_events:
            continue
        seen_events.append(eid)
        if not first_run and etype in RENDER_EVENTS:
            messages.append(RENDER_EVENTS[etype])
    r["events"] = seen_events[-100:]
    r["eventsSince"] = newest
    r["initialised"] = True

    if suspended:
        return {"ok": False, "detail": f"{name} is SUSPENDED in Render", "metrics": metrics}, messages
    if dstatus in DEPLOY_FAILED:
        return {"ok": True, "detail": f"{name}: last deploy {dstatus} ({metrics['deployCommit']}), the previous version is still serving", "metrics": metrics}, messages
    return {"ok": True, "detail": f"{name}: last deploy {dstatus} ({metrics['deployCommit'] or '?'})", "metrics": metrics}, messages



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
    "render": "Render service",
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
            if state.get("apiCommit") == api.get("commit"):
                notes.append(f"ℹ️ The API restarted {fmt_duration(uptime)} ago without a new deploy (crash or sleep): Render -> Logs.")
        state["apiUptime"], state["apiCommit"] = uptime, api.get("commit")
    db_ms = api.get("dbLatencyMs")
    if isinstance(db_ms, (int, float)) and db_ms > DB_LATENCY_WARN_MS:
        if not state.get("dbSlowAlerted"):
            notes.append(f"🟠 Database latency is {db_ms} ms (normal: under {DB_LATENCY_WARN_MS}): Render and Atlas may be in different regions (INFRASTRUCTURE.md 2.4).")
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
            lines.append(f"  {datetime.fromtimestamp(ts).astimezone().strftime('%H:%M')}  {first}")
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
            when = datetime.fromtimestamp(iso_to_ts(p["merged_at"])).astimezone().strftime("%d/%m %H:%M")
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


def summary(results: dict, state: dict) -> str:
    bad = [n for n, r in results.items() if not r["ok"]]
    stamp = datetime.now().astimezone().strftime("%a %d %b, %H:%M")
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
    rm = results.get("render", {}).get("metrics", {})
    if rm.get("autoDeploy") == "no":
        lines.append("⚠️ Render auto-deploy is OFF: merging to main does not deploy the API.")
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
    p.add_argument("--timeout", type=float, default=60, help="seconds per request (60 covers a Render cold start)")
    p.add_argument("--no-render", action="store_true", help="skip the Render API checks")
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

    render_messages: list[str] = []
    # The API moved to Railway on 2026-10-07 and the Render service is suspended: the Render checks run only when
    # NHC_WATCH_RENDER=1 is set on purpose (otherwise a leftover key would report the suspension as an outage).
    key = render_key(state_path) if os.environ.get("NHC_WATCH_RENDER") == "1" and not args.no_render else None
    if key:
        results["render"], render_messages = render_check(key, state, args.timeout, ctx, now)

    lines = evaluate(results, state, now, confirm, remind_s)
    lines += render_messages
    record_run(results, lines, state, now)
    changes = changes_report(state, api, args.timeout, ctx, now) if args.summary else []
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
