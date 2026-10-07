'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Badge, DataTable, type Tone } from '@/components/ui/DataTable';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import {
  isApiError, recordingAnswerSchema, recordingDeleteSchema, recordingSchema, recordingsStateSchema, type Recording, type RecordingsState,
  type RecordingStatus,
} from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { storedLength } from '@/lib/entities';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { formatElapsed } from '@/lib/media';

// The recordings of past broadcasts (docs/LIVE.md "Recordings"): title (renamed in place), picture, date, length,
// status, a Publish switch (only for a ready recording: the website shows published ones), a preview with Cloudflare's
// own player (loaded only when asked for), and Delete (also at Cloudflare). While anything is uploading or processing,
// the list is asked for again every 15 seconds while the page is visible (each read makes the API check Cloudflare).

const TITLE_MAX = 120;
const POLL_MS = 15_000;
const STATUS_TONE: Record<RecordingStatus, Tone> = { uploading: 'info', processing: 'gold', ready: 'success', failed: 'danger' };

type Props = { initial: RecordingsState; timeZone: string };

/** The list as the API sees it now (each read makes it check unfinished videos with Cloudflare), or null. */
async function reload(): Promise<RecordingsState | null> {
  try {
    return await proxyCall({ path: 'live/recordings', schema: recordingsStateSchema });
  } catch {
    return null; // the list stays as it was; the next poll tries again
  }
}

export function LiveRecordings({ initial, timeZone }: Props) {
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();
  const uid = useId();
  // The server's answer is the starting point; a newer one (router.refresh) replaces what this list polled.
  const [prev, setPrev] = useState(initial);
  const [data, setData] = useState(initial);
  if (initial !== prev) {
    setPrev(initial);
    setData(initial);
  }
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Recording | null>(null);
  const [checking, setChecking] = useState(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  const unfinished = data.items.some((r) => r.status === 'uploading' || r.status === 'processing');

  useEffect(() => {
    if (!unfinished) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload().then((fresh) => { if (fresh) setData(fresh); });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [unfinished]);

  useEffect(() => {
    if (preview) previewHeading.current?.focus();
  }, [preview]);

  useEffect(() => {
    if (editing) titleInput.current?.focus();
  }, [editing]);

  const put = (recording: Recording) => setData((d) => ({ ...d, items: d.items.map((r) => (r.id === recording.id ? recording : r)) }));
  const fail = (e: unknown) => {
    if (isApiError(e) && e.unauthorized) return;
    toast(isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : t('error.generic'), 'error');
  };
  /** A 409 carries the recording as the API sees it now (e.g. still processing). */
  const fromConflict = (e: unknown) => {
    if (!isApiError(e) || e.status !== 409) return;
    const parsed = recordingSchema.safeParse((e.body as { recording?: unknown } | undefined)?.recording);
    if (parsed.success) put(parsed.data);
  };

  async function check() {
    setChecking(true);
    const fresh = await reload();
    if (fresh) setData(fresh);
    setChecking(false);
  }

  async function setPublished(r: Recording, published: boolean) {
    setBusy(`${r.id}:publish`);
    try {
      const { recording } = await proxyCall({ method: 'PATCH', path: `live/recordings/${r.id}`, body: { published }, schema: recordingAnswerSchema });
      put(recording);
      toast(t(published ? 'live.rec.publishedToast' : 'live.rec.unpublishedToast', { title: recording.title }), 'success');
    } catch (e) {
      fromConflict(e);
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  function startRename(r: Recording) {
    setEditing(r.id);
    setDraft(r.title);
    setDraftError(null);
  }

  async function rename(event: FormEvent, r: Recording) {
    event.preventDefault();
    const title = draft.trim();
    if (!title || storedLength(title) > TITLE_MAX) {
      setDraftError(t('live.rec.errTitle'));
      return;
    }
    setBusy(`${r.id}:rename`);
    try {
      const { recording } = await proxyCall({ method: 'PATCH', path: `live/recordings/${r.id}`, body: { title }, schema: recordingAnswerSchema });
      put(recording);
      setEditing(null);
      toast(t('live.rec.renamed'), 'success');
    } catch (e) {
      fail(e); // what was typed stays in the field
    } finally {
      setBusy(null);
    }
  }

  async function remove(r: Recording) {
    const ok = await confirm({ title: t('live.rec.deleteTitle', { title: r.title }), message: t('live.rec.deleteText'), confirmLabel: t('live.rec.delete'), tone: 'danger' });
    if (!ok) return;
    setBusy(`${r.id}:delete`);
    try {
      const answer = await proxyCall({ method: 'DELETE', path: `live/recordings/${r.id}`, schema: recordingDeleteSchema });
      setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== r.id) }));
      if (preview?.id === r.id) setPreview(null);
      toast(answer.cloudflareDeleted ? t('live.rec.deleted') : t('live.rec.deletedLocalOnly'), answer.cloudflareDeleted ? 'success' : 'info');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  // ---- storage: minutes stored at Cloudflare, and what that costs a month
  const { storage } = data;
  const share = storage.limitMinutes > 0 ? storage.usedMinutes / storage.limitMinutes : 0;
  const full = share > 0.8;
  const cost = formatMoney((storage.usedMinutes / 1000) * storage.pricePer1000Minutes, locale);
  const price = formatMoney(storage.pricePer1000Minutes, locale, true);

  return (
    <section className="panel" aria-labelledby={`${uid}-title`} data-testid="live-recordings">
      <div className="panel__head">
        <h2 id={`${uid}-title`} className="panel__title">{t('live.rec.title')}</h2>
        {unfinished ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void check()} disabled={checking} aria-busy={checking || undefined} data-testid="rec-refresh">
            {checking ? <span className="spinner" aria-hidden="true" /> : <Icon name="clock" size={16} />}
            <span>{t('live.rec.refresh')}</span>
          </button>
        ) : null}
      </div>
      <p className="hint">{t('live.rec.lead')}</p>
      <p className={`hint storage-line${full ? ' hint--warn' : ''}`} data-testid="rec-storage">
        {full ? <Icon name="alert" size={16} /> : null}
        <span>{t('live.storage.used', { used: formatNumber(storage.usedMinutes, locale), limit: formatNumber(storage.limitMinutes, locale), cost, price })}</span>
      </p>
      {full ? <p className="hint hint--warn storage-line">{t('live.storage.warn')}</p> : null}
      {storage.source === 'estimate' ? <p className="hint storage-line">{t('live.storage.estimate')}</p> : null}
      {unfinished ? <p className="hint storage-line">{t('live.rec.polling')}</p> : null}
      <p id={`${uid}-not-ready`} className="visually-hidden">{t('live.rec.publishNotReady')}</p>

      {data.items.length === 0 ? (
        <p className="hint" data-testid="rec-empty">{t('live.rec.empty')}</p>
      ) : (
        <DataTable
          caption={t('live.rec.title')}
          rows={data.items}
          rowKey={(r) => r.id}
          columns={[
            {
              key: 'title', header: t('live.rec.colTitle'), primary: true,
              cell: (r) => editing === r.id ? (
                <form className="inline-form" onSubmit={(e) => void rename(e, r)} noValidate>
                  <input
                    className="input"
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); if (draftError) setDraftError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                    maxLength={TITLE_MAX}
                    dir="auto"
                    autoComplete="off"
                    aria-label={t('live.rec.newTitle', { title: r.title })}
                    aria-invalid={draftError ? true : undefined}
                    aria-describedby={draftError ? `${uid}-rename-err` : undefined}
                    data-testid="rec-title-input"
                    ref={titleInput}
                  />
                  <button type="submit" className="btn btn--gold btn--sm" disabled={busy === `${r.id}:rename`} aria-busy={busy === `${r.id}:rename` || undefined}>{t('live.rec.save')}</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(null)}>{t('live.rec.cancel')}</button>
                  {draftError ? <p id={`${uid}-rename-err`} className="form__error"><Icon name="alert" size={16} /><span>{draftError}</span></p> : null}
                </form>
              ) : <span className="strong" dir="auto" data-testid="rec-title">{r.title}</span>,
            },
            {
              key: 'picture', header: t('live.rec.colPicture'),
              cell: (r) => r.status === 'ready' && r.thumbnailUrl
                ? <img className="rec-thumb" src={r.thumbnailUrl} alt={r.title} loading="lazy" width={112} height={63} />
                : <span className="rec-thumb rec-thumb--empty"><Icon name="video" size={20} /><span className="visually-hidden">{t('live.rec.noPicture')}</span></span>,
            },
            { key: 'date', header: t('live.rec.colDate'), className: 'cell-nowrap', cell: (r) => formatDateTime(r.liveStartedAt, locale, timeZone) },
            { key: 'duration', header: t('live.rec.colDuration'), align: 'end', className: 'cell-nowrap', cell: (r) => <bdi className="ltr">{formatElapsed(r.durationSeconds * 1000)}</bdi> },
            {
              key: 'status', header: t('live.rec.colStatus'),
              cell: (r) => (
                <span>
                  <Badge tone={STATUS_TONE[r.status]}>{t(`live.rec.status.${r.status}`)}</Badge>
                  {r.status === 'failed' && r.failReason ? <span className="cell-sub">{r.failReason}</span> : null}
                </span>
              ),
            },
            {
              key: 'website', header: t('live.rec.colWebsite'),
              cell: (r) => (
                <span>
                  <span className="switch-row">
                    <button
                      type="button"
                      role="switch"
                      className="switch"
                      aria-checked={r.published}
                      aria-label={t('live.rec.publishLabel', { title: r.title })}
                      disabled={r.status !== 'ready' || busy === `${r.id}:publish`}
                      aria-busy={busy === `${r.id}:publish` || undefined}
                      onClick={() => void setPublished(r, !r.published)}
                      aria-describedby={r.status !== 'ready' ? `${uid}-not-ready` : undefined}
                      title={r.status !== 'ready' ? t('live.rec.publishNotReady') : undefined}
                      data-testid="rec-publish"
                    >
                      <span className="switch__track" aria-hidden="true"><span className="switch__thumb" /></span>
                    </button>
                    <span className="switch-row__state" data-testid="rec-published-state">{r.published ? t('live.rec.published') : t('live.rec.notPublished')}</span>
                  </span>
                </span>
              ),
            },
            {
              key: 'actions', header: t('live.rec.colActions'),
              cell: (r) => (
                <div className="row-actions">
                  <button type="button" className="icon-btn" onClick={() => startRename(r)} aria-label={t('live.rec.renameLabel', { title: r.title })} title={t('live.rec.rename')} data-testid="rec-rename">
                    <Icon name="edit" size={18} />
                  </button>
                  {r.status === 'ready' && r.playbackUrl ? (
                    <button type="button" className="icon-btn" onClick={() => setPreview(r)} aria-label={t('live.rec.previewLabel', { title: r.title })} title={t('live.rec.preview')} data-testid="rec-preview">
                      <Icon name="video" size={18} />
                    </button>
                  ) : null}
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => void remove(r)} disabled={busy === `${r.id}:delete`} aria-busy={busy === `${r.id}:delete` || undefined} aria-label={t('live.rec.deleteLabel', { title: r.title })} title={t('live.rec.delete')} data-testid="rec-delete">
                    {busy === `${r.id}:delete` ? <span className="spinner" aria-hidden="true" /> : <Icon name="trash" size={18} />}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {preview?.playbackUrl ? (
        <div className="rec-preview" data-testid="rec-preview-player">
          <div className="rec-preview__head">
            <h3 ref={previewHeading} tabIndex={-1} className="rec-preview__title" dir="auto">{t('live.rec.previewTitle', { title: preview.title })}</h3>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPreview(null)}>
              <Icon name="x" size={16} />
              <span>{t('live.rec.closePreview')}</span>
            </button>
          </div>
          {/* Cloudflare's own player page (the API builds the address; lib/api.ts keeps only Cloudflare's). */}
          <iframe
            className="rec-preview__frame"
            src={preview.playbackUrl}
            title={t('live.rec.previewFrame', { title: preview.title })}
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        </div>
      ) : null}
    </section>
  );
}
