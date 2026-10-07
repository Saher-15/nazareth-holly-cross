'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { PreviewSlot, useLiveBroadcast, useTicker } from '@/components/live/LiveBroadcast';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError, liveStopSchema, type LiveSession, type ScheduledBroadcast } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { formatElapsed } from '@/lib/media';
import { heldRecordingIds, holdRecordingLock, type LocalRecording } from '@/lib/recording-store';
import type { Role } from '@/lib/roles';
import { matchScheduled, NAZARETH_TIME_ZONE } from '@/lib/schedule';
import { megabytes, UnfinishedRecordings, UploadStatus } from './RecordingUploads';

// The studio of the Live page (docs/LIVE.md):
//   1. turn on the camera and microphone (the browser asks), see the preview, choose devices, front/back on a phone
//   2. a title, "Go live": the API creates the Cloudflare input and returns the WHIP address (only to this tab), the
//      browser publishes to it (lib/whip.ts); the website's /live page shows the player within seconds
//   3. LIVE badge and elapsed time, mute, switch camera while live, "End broadcast"
// The broadcast itself (camera, WHIP, recorder, wake lock, uploads) belongs to the dashboard's layout
// (components/live/LiveBroadcast.tsx): the admin can open other dashboard pages while live (a bar shows the broadcast
// there, components/live/LiveBar.tsx) and come back here. Closing or reloading the tab ends it (a keepalive "stop";
// the browser asks first).
//
// Recording (on by default, "Record this broadcast"): the tab records what it publishes (lib/recorder.ts: a canvas +
// WebAudio mixer, so switching the camera or the microphone never stops it), keeps every piece in memory and in
// IndexedDB (lib/recording-store.ts), and after "End broadcast" uploads the file straight to Cloudflare
// (RecordingUploads.tsx, lib/tus.ts). A recording left behind by a closed tab is offered again on the next visit.
// "Go live" can name the scheduled broadcast it fulfils; the closest one within two hours is suggested.

type Props = {
  configured: boolean;
  current: LiveSession | null;
  maxMinutes: number;
  me: { id: string; role: Role };
  /** Scheduled broadcasts still waiting (status "scheduled"): "Go live" may fulfil one. */
  scheduled?: ScheduledBroadcast[];
  /** The dashboard's time zone for printed dates (the server's ADMIN_TIMEZONE). */
  timeZone?: string;
};

const TITLE_MAX = 120;

/** The clock, for event handlers (never called while rendering). */
const clock = () => Date.now();

export function LiveStudio({ configured, current, maxMinutes, me, scheduled = [], timeZone = NAZARETH_TIME_ZONE }: Props) {
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();
  const router = useRouter();
  const uid = useId();
  const live = useLiveBroadcast();
  const { phase, stream, isLive, whipState, store, queue, registerStudio, ensureStore, cameras, microphones, hasAudio, muted, error, recordSupport, recordingInfo } = live;
  const scheduleTouched = useRef(false);

  const [title, setTitle] = useState(() => live.session?.title ?? '');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [record, setRecord] = useState(true);
  const [scheduleId, setScheduleId] = useState('');
  const [unfinished, setUnfinished] = useState<LocalRecording[]>([]);
  const waiting = scheduled.filter((s) => s.status === 'scheduled');

  // The broadcast that is live on the server and is NOT this tab's (another admin, or this admin before a reload).
  const other = current && current.id !== live.session?.id ? current : null;
  const now = useTicker(isLive || Boolean(other));

  // While the studio is on screen the camera may stay on without broadcasting; leaving the page turns it off then.
  useEffect(() => registerStudio(), [registerStudio]);

  // ---- this browser's copy of recordings: offer what an earlier visit left behind
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const opened = await ensureStore();
      if (cancelled || !opened) return;
      try {
        const [list, held] = await Promise.all([opened.list(), heldRecordingIds()]);
        const free = list.filter((r) => !held.has(r.localId));
        // A copy without a single piece (the tab died at once) is only clutter.
        for (const empty of free.filter((r) => r.sizeBytes === 0)) await opened.remove(empty.localId).catch(() => undefined);
        // Only the admin who recorded it (or an owner) can upload it; another tab's recording is left alone.
        if (!cancelled) setUnfinished(free.filter((r) => r.sizeBytes > 0 && (r.userId === me.id || me.role === 'owner')));
      } catch {
        // nothing is offered
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureStore, me.id, me.role]);

  // ---- camera
  async function openCamera() {
    if (phase !== 'off') return;
    if (!(await live.openCamera())) return;
    // The scheduled broadcast this one most likely fulfils (within two hours).
    if (!scheduleTouched.current) {
      const match = matchScheduled(waiting, clock());
      if (match) {
        setScheduleId(match.id);
        setTitle((typed) => (typed.trim() ? typed : match.title));
      }
    }
  }

  function chooseSchedule(id: string) {
    scheduleTouched.current = true;
    setScheduleId(id);
    const item = waiting.find((s) => s.id === id);
    if (item) {
      setTitle(item.title);
      setTitleError(null);
    }
  }

  // ---- going live and ending
  const message = (e: unknown, fallback: string) => (isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : fallback);

  async function goLive(event: FormEvent) {
    event.preventDefault();
    if (phase !== 'preview' || !stream) return;
    const text = title.trim();
    if (!text) {
      setTitleError(t('live.errTitle'));
      return;
    }
    setTitleError(null);
    const planned = waiting.some((s) => s.id === scheduleId) ? scheduleId : '';
    if (await live.goLive({ title: text, scheduleId: planned, record })) {
      setScheduleId('');
      scheduleTouched.current = false;
    }
  }

  // ---- recordings left behind by an earlier visit
  async function uploadUnfinished(meta: LocalRecording) {
    const opened = store;
    if (!opened) return;
    const release = await holdRecordingLock(meta.localId);
    if (!release) {
      toast(t('live.unfinished.inUse'), 'error');
      return;
    }
    let chunks: Blob[] = [];
    try {
      chunks = await opened.chunks(meta.localId);
    } catch {
      chunks = [];
    }
    const blob = new Blob(chunks, { type: meta.mimeType });
    setUnfinished((list) => list.filter((r) => r.localId !== meta.localId));
    queue.add({ meta: { ...meta, sizeBytes: blob.size, state: meta.state === 'recording' ? 'stopped' : meta.state }, blob, release });
  }

  async function discardUnfinished(meta: LocalRecording) {
    const ok = await confirm({ title: t('live.upload.discardTitle', { title: meta.title }), message: t('live.upload.discardText'), confirmLabel: t('live.unfinished.discard'), tone: 'danger' });
    if (!ok) return;
    await store?.remove(meta.localId).catch(() => undefined);
    setUnfinished((list) => list.filter((r) => r.localId !== meta.localId));
    toast(t('live.upload.discarded'), 'success');
  }

  async function discardUpload() {
    const ok = await confirm({ title: t('live.upload.discardTitle', { title: live.uploadView.title }), message: t('live.upload.discardText'), confirmLabel: t('live.upload.discard'), tone: 'danger' });
    if (!ok) return;
    await queue.discard();
    toast(t('live.upload.discarded'), 'success');
  }

  async function endOther(target: LiveSession) {
    const mine = target.startedBy.id === me.id;
    const ok = await confirm(
      mine
        ? { title: t('live.stopTitle'), message: t('live.stopText'), confirmLabel: t('live.stop'), tone: 'danger' }
        : { title: t('live.forceTitle'), message: t('live.forceText', { name: target.startedBy.name }), confirmLabel: t('live.forceStop'), tone: 'danger' },
    );
    if (!ok) return;
    try {
      await proxyCall({ method: 'POST', path: 'live/stop', body: { sessionId: target.id, ...(mine ? {} : { force: true }) }, schema: liveStopSchema });
      toast(t('live.stoppedToast'), 'success');
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      toast(message(e, t('live.errStop')), 'error');
    }
    router.refresh();
  }

  // ---- render
  if (!configured) {
    return (
      <div className="state" role="status" data-testid="live-not-configured">
        <Icon name="broadcast" size={32} />
        <h2 className="state__title">{t('live.notConfiguredTitle')}</h2>
        <p className="state__text">{t('live.notConfiguredText')}</p>
      </div>
    );
  }

  const elapsed = live.liveSince ? formatElapsed(Math.max(0, now - live.liveSince)) : '';
  const otherMinutes = other ? Math.max(0, Math.round((now - new Date(other.startedAt).getTime()) / 60_000)) : 0;
  const canEndOther = other && (other.startedBy.id === me.id || me.role === 'owner');
  const connecting = phase === 'starting' || (phase === 'live' && (whipState === 'connecting' || whipState === 'idle'));

  return (
    <div className="grid grid--studio">
      <UnfinishedRecordings
        items={unfinished.filter((r) => !queue.has(r.localId))}
        disabled={isLive || phase === 'starting'}
        timeZone={timeZone}
        onUpload={(meta) => void uploadUnfinished(meta)}
        onDiscard={(meta) => void discardUnfinished(meta)}
      />
      {other ? (
        <section className="panel live-other" aria-labelledby={`${uid}-other`} data-testid="live-other">
          <div className="panel__head">
            <h2 id={`${uid}-other`} className="panel__title">
              <span className="live-badge"><span className="live-badge__dot" aria-hidden="true" />{t('live.badge')}</span>{' '}
              {t('live.otherLiveTitle')}
            </h2>
          </div>
          <p>{t('live.otherLiveText', { title: other.title, name: other.startedBy.name, minutes: otherMinutes })}</p>
          <p className="hint">{t('live.otherLiveHint', { hours: Math.round(maxMinutes / 60) })}</p>
          {canEndOther ? (
            <div>
              <button type="button" className="btn btn--ghost-danger" onClick={() => void endOther(other)} data-testid="live-end-other">
                <Icon name="stop" size={16} />
                <span>{other.startedBy.id === me.id ? t('live.stop') : t('live.forceStop')}</span>
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel studio" aria-labelledby={`${uid}-studio`}>
        <div className="panel__head">
          <h2 id={`${uid}-studio`} className="panel__title">{t('live.studioTitle')}</h2>
          {isLive ? (
            <span className="live-badge" data-testid="live-badge">
              <span className="live-badge__dot" aria-hidden="true" />
              {t('live.badge')}
              <span className="live-badge__time ltr" data-testid="live-elapsed">{elapsed}</span>
            </span>
          ) : null}
        </div>

        <div className="studio__body">
          <div className="studio__preview" data-live={isLive || undefined}>
            {/* The camera's <video> belongs to the layout (it keeps feeding the recording on other pages): shown here. */}
            <PreviewSlot
              className="studio__slot"
              videoClassName={`studio__video${live.mirrored ? ' studio__video--mirror' : ''}`}
              label={t('live.previewLabel')}
              testId="live-preview"
            />
            {!stream ? (
              <div className="studio__placeholder">
                <Icon name="video" size={36} />
                <p>{t('live.previewOff')}</p>
              </div>
            ) : null}
          </div>

          <div className="studio__controls stack">
            {phase === 'off' || phase === 'opening' ? (
              <div className="stack">
                <div>
                  <button type="button" className="btn btn--gold" onClick={() => void openCamera()} disabled={phase === 'opening' || Boolean(other)} aria-busy={phase === 'opening' || undefined} data-testid="live-camera-on">
                    {phase === 'opening' ? <span className="spinner" aria-hidden="true" /> : <Icon name="video" size={16} />}
                    <span>{t('live.cameraOn')}</span>
                  </button>
                </div>
                <p className="hint">{t('live.cameraHint')}</p>
              </div>
            ) : (
              <>
                <div className="studio__devices">
                  {cameras.length > 0 ? (
                    <div className="field">
                      <label htmlFor={`${uid}-camera`}>{t('live.camera')}</label>
                      <select id={`${uid}-camera`} className="select" value={live.videoId} onChange={(e) => void live.chooseCamera(e.target.value)} data-testid="live-camera">
                        {cameras.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                      </select>
                    </div>
                  ) : null}
                  {hasAudio && microphones.length > 0 ? (
                    <div className="field">
                      <label htmlFor={`${uid}-mic`}>{t('live.microphone')}</label>
                      <select id={`${uid}-mic`} className="select" value={live.audioId} onChange={(e) => void live.chooseMicrophone(e.target.value)} data-testid="live-microphone">
                        {microphones.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                      </select>
                    </div>
                  ) : null}
                </div>
                {!hasAudio ? <p className="hint">{t('live.noMicrophone')}</p> : null}

                <div className="studio__buttons">
                  {cameras.length > 1 ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void live.switchCamera()} data-testid="live-switch">
                      <Icon name="switchCamera" size={16} />
                      <span>{t('live.switchCamera')}</span>
                    </button>
                  ) : null}
                  {hasAudio ? (
                    <button type="button" className="btn btn--ghost btn--sm" aria-pressed={muted} onClick={live.toggleMute} data-testid="live-mute">
                      <Icon name={muted ? 'micOff' : 'mic'} size={16} />
                      <span>{muted ? t('live.unmute') : t('live.mute')}</span>
                    </button>
                  ) : null}
                  {!isLive && phase !== 'starting' ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={live.closeCamera} data-testid="live-camera-off">
                      <Icon name="x" size={16} />
                      <span>{t('live.cameraOff')}</span>
                    </button>
                  ) : null}
                </div>
                {muted ? <p className="hint" data-testid="live-muted"><Icon name="micOff" size={16} /> {t('live.muted')}</p> : null}

                {isLive ? (
                  <div className="stack">
                    {recordingInfo ? (
                      <p className="rec-indicator" data-testid="live-recording">
                        <span className="rec-indicator__dot" aria-hidden="true" />
                        <span>{t('live.recordingNow', { size: megabytes(recordingInfo.size, locale) })}</span>
                      </p>
                    ) : null}
                    {recordingInfo && !recordingInfo.persisted ? <p className="hint hint--warn" data-testid="live-recording-memory"><Icon name="alert" size={16} /> {t('live.recordingMemoryOnly')}</p> : null}
                    <p className="hint">{t('live.leaveHint')}</p>
                    <div>
                      <button type="button" className="btn btn--danger" onClick={() => void live.endBroadcast()} disabled={phase === 'ending'} aria-busy={phase === 'ending' || undefined} data-testid="live-stop">
                        {phase === 'ending' ? <span className="spinner" aria-hidden="true" /> : <Icon name="stop" size={16} />}
                        <span>{t('live.stop')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form className="form" onSubmit={goLive} noValidate>
                    {waiting.length > 0 ? (
                      <div className="field">
                        <label htmlFor={`${uid}-schedule`}>{t('live.fulfils')}</label>
                        <select id={`${uid}-schedule`} className="select" value={waiting.some((s) => s.id === scheduleId) ? scheduleId : ''} onChange={(e) => chooseSchedule(e.target.value)} aria-describedby={`${uid}-schedule-hint`} data-testid="live-fulfils">
                          <option value="">{t('live.fulfilsNone')}</option>
                          {waiting.map((s) => (
                            <option key={s.id} value={s.id}>{t('live.fulfilsOption', { title: s.title, time: formatDateTime(s.startsAt, locale, NAZARETH_TIME_ZONE) })}</option>
                          ))}
                        </select>
                        <p id={`${uid}-schedule-hint`} className="hint">{t('live.fulfilsHint')}</p>
                      </div>
                    ) : null}
                    <div className="field">
                      <label htmlFor={`${uid}-title`}>{t('live.title')}</label>
                      <input
                        id={`${uid}-title`}
                        className="input"
                        value={title}
                        onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(null); }}
                        maxLength={TITLE_MAX}
                        required
                        dir="auto"
                        autoComplete="off"
                        aria-invalid={titleError ? true : undefined}
                        aria-describedby={`${uid}-title-hint${titleError ? ` ${uid}-title-err` : ''}`}
                        data-testid="live-title"
                      />
                      <p id={`${uid}-title-hint`} className="hint">{t('live.titleHint', { n: title.length, max: TITLE_MAX })}</p>
                      {titleError ? <p id={`${uid}-title-err`} className="form__error"><Icon name="alert" size={16} /><span>{titleError}</span></p> : null}
                    </div>
                    {recordSupport === 'no' ? (
                      <p className="hint" data-testid="live-record-unsupported">{t('live.recordUnsupported')}</p>
                    ) : (
                      <div className="field">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={record}
                          className="switch"
                          onClick={() => setRecord((on) => !on)}
                          aria-describedby={`${uid}-record-hint`}
                          data-testid="live-record"
                        >
                          <span className="switch__track" aria-hidden="true"><span className="switch__thumb" /></span>
                          <span>{t('live.record')}</span>
                        </button>
                        <p id={`${uid}-record-hint`} className="hint">{t('live.recordHint')}</p>
                      </div>
                    )}
                    <div>
                      <button type="submit" className="btn btn--gold" disabled={phase !== 'preview' || Boolean(other)} aria-busy={phase === 'starting' || undefined} data-testid="live-go">
                        {phase === 'starting' ? <span className="spinner" aria-hidden="true" /> : <Icon name="broadcast" size={16} />}
                        <span>{t('live.goLive')}</span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            <div className="form__error" role="alert" data-testid="live-error">
              {error ? (
                <>
                  <Icon name="alert" size={18} />
                  <span>{error.text}</span>
                  {error.reload ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.location.reload()}>{t('live.reload')}</button>
                  ) : null}
                </>
              ) : null}
            </div>
            {isLive && whipState === 'failed' ? <p className="form__error" data-testid="live-failed"><Icon name="alert" size={18} /><span>{t('live.failed')}</span></p> : null}
            {connecting ? <p className="hint" data-testid="live-connecting"><span className="spinner" aria-hidden="true" /> {t('live.connecting')}</p> : null}
            {isLive && whipState === 'reconnecting' ? <p className="hint" data-testid="live-reconnecting">{t('live.reconnecting')}</p> : null}
            <p className="visually-hidden" role="status" aria-live="polite" data-testid="live-status">{live.announcement}</p>
            <UploadStatus view={live.uploadView} announcement={live.uploadAnnouncement} onRetry={() => queue.retry()} onDiscard={() => void discardUpload()} />
            <p className="hint">{t('live.costHint')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
