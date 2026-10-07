'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import type { Locale } from '@/i18n/locales';
import { recordingAnswerSchema, recordingUploadSchema, type Recording } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { formatDateTime, localeTag } from '@/lib/format';
import { formatElapsed } from '@/lib/media';
import type { LocalRecording, RecordingStore } from '@/lib/recording-store';
import { RecordingUploadJob, UploadStopped, type RecordingApi, type UploadPhase } from '@/lib/recording-upload';
import { holdSession } from '@/lib/session-hold';
import { crossedMilestone } from '@/lib/tus';

// The recordings of this browser on their way to Cloudflare (docs/LIVE.md "Recordings"): one upload at a time, in order
// (a broadcast that ends while the previous one is still uploading waits its turn), with progress, polite announcements
// every quarter, Retry after a pause, Discard, and a "leave the page?" question while anything is still to send.
// The upload keeps going if the admin opens another dashboard page (the page's Content-Security-Policy stays /live's).

/** The API calls an upload needs, through the dashboard's proxy (lib/proxy-allow.ts). */
export const recordingApi: RecordingApi = {
  create: (body) => proxyCall({ method: 'POST', path: 'live/recordings', body, schema: recordingUploadSchema }),
  renew: (id, body) => proxyCall({ method: 'POST', path: `live/recordings/${id}/upload-url`, body, schema: recordingUploadSchema }),
  uploaded: (id) => proxyCall({ method: 'POST', path: `live/recordings/${id}/uploaded`, schema: recordingAnswerSchema }),
};

export type UploadItem = { meta: LocalRecording; blob: Blob; release: (() => void) | null };

export type QueueView = {
  phase: UploadPhase | 'idle';
  title: string;
  sent: number;
  total: number;
  problem: UploadStopped | null;
  /** Seconds until the next try after a network failure (null when not waiting). */
  retryIn: number | null;
  waiting: number;
};

type Handlers = {
  onDone(title: string, recording: Recording): void;
  onMilestone(percent: number): void;
  onProblem(problem: UploadStopped): void;
};

const IDLE: QueueView = { phase: 'idle', title: '', sent: 0, total: 0, problem: null, retryIn: null, waiting: 0 };

/** The queue lives outside React (the upload outlives re-renders); components read it with useSyncExternalStore. */
export class UploadQueue {
  view: QueueView = IDLE;
  store: RecordingStore | null = null;
  handlers: Handlers = { onDone: () => undefined, onMilestone: () => undefined, onProblem: () => undefined };
  private items: UploadItem[] = [];
  private active: { item: UploadItem; job: RecordingUploadJob } | null = null;
  private listeners = new Set<() => void>();
  private percent = 0;
  private readonly api: RecordingApi;

  constructor(api: RecordingApi) {
    this.api = api;
  }

  setStore(store: RecordingStore | null) {
    this.store = store;
  }

  setHandlers(handlers: Handlers) {
    this.handlers = handlers;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getView = () => this.view;

  /** Something is being sent or waits to be: the page asks before it is left. */
  get busy() {
    return Boolean(this.active) || this.items.length > 0;
  }

  has(localId: string) {
    return this.active?.item.meta.localId === localId || this.items.some((i) => i.meta.localId === localId);
  }

  add(item: UploadItem) {
    if (this.has(item.meta.localId)) return;
    this.items.push(item);
    this.set({ waiting: this.items.length - (this.active ? 0 : 1) });
    if (!this.active) void this.next();
  }

  /** Retry after a pause or a failure that can be retried: a paused upload goes on where Cloudflare stopped. */
  retry() {
    if (this.active && (this.view.phase === 'paused' || (this.view.phase === 'failed' && this.view.problem?.retryable))) void this.run();
  }

  /** Gives the current recording up: the copy on this device is deleted (the caller asked first). */
  async discard() {
    const active = this.active;
    if (!active) return;
    this.active = null;
    active.job.abort();
    await this.store?.remove(active.item.meta.localId).catch(() => undefined);
    active.item.release?.();
    this.set({ ...IDLE, waiting: this.items.length });
    void this.next();
  }

  private set(patch: Partial<QueueView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }

  private progress(sent: number, total: number) {
    const percent = total ? Math.floor((sent / total) * 100) : 0;
    const milestone = crossedMilestone(this.percent, percent);
    if (percent !== this.percent || sent === 0 || this.view.retryIn !== null) this.set({ sent, total, retryIn: null });
    this.percent = percent;
    if (milestone) this.handlers.onMilestone(milestone);
  }

  private async next() {
    const item = this.items.shift();
    if (!item) return;
    const job = new RecordingUploadJob({
      meta: item.meta,
      blob: item.blob,
      api: this.api,
      store: this.store,
      onPhase: (phase) => this.set({ phase }),
      onProgress: (sent, total) => this.progress(sent, total),
      tus: { onRetry: (_failures, ms) => this.set({ retryIn: Math.round(ms / 1000) }) },
    });
    this.active = { item, job };
    this.percent = 0;
    this.set({ phase: 'address', title: item.meta.title, sent: 0, total: item.blob.size, problem: null, retryIn: null, waiting: this.items.length });
    await this.run();
  }

  private async run() {
    const active = this.active;
    if (!active) return;
    this.set({ problem: null, retryIn: null });
    try {
      const recording = await active.job.run();
      if (this.active !== active) return; // discarded meanwhile
      this.active = null;
      active.item.release?.();
      this.set({ phase: 'done', sent: this.view.total, problem: null, waiting: this.items.length });
      this.handlers.onDone(active.item.meta.title, recording);
      void this.next();
    } catch (error) {
      if (this.active !== active) return;
      const problem = error instanceof UploadStopped ? error : new UploadStopped('other', true);
      this.set({ phase: problem.retryable ? 'paused' : 'failed', problem, retryIn: null });
      this.handlers.onProblem(problem);
    }
  }
}

/** The page's upload queue, its view, and a "leave the page?" question while it is busy. */
export function useUploadQueue(store: RecordingStore | null) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const router = useRouter();
  const [queue] = useState(() => new UploadQueue(recordingApi));
  const view = useSyncExternalStore(queue.subscribe, queue.getView, queue.getView);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    queue.setStore(store);
  }, [queue, store]);

  useEffect(() => {
    queue.setHandlers({
      onDone: (title, recording) => {
        const text = t('live.upload.done', { title });
        toast(text, 'success');
        setAnnouncement(text);
        void recording;
        router.refresh();
      },
      onMilestone: (percent) => setAnnouncement(t('live.upload.announce', { percent })),
      onProblem: (problem) => setAnnouncement(problemText(t, problem)),
    });
  }, [queue, t, toast, router]);

  const busy = view.phase !== 'idle' && view.phase !== 'done';
  useEffect(() => {
    if (!busy && view.waiting === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.busy) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [busy, view.waiting, queue]);

  // While something is being sent (or waits, or can be retried) the idle sign-out must not leave the page: that would
  // stop the upload (lib/session-hold.ts). A failure that a retry cannot fix does not hold the session.
  const holding = (busy || view.waiting > 0) && !(view.phase === 'failed' && !view.problem?.retryable);
  useEffect(() => (holding ? holdSession() : undefined), [holding]);

  return { queue, view, announcement };
}

export function problemText(t: ReturnType<typeof useI18n>['t'], problem: UploadStopped): string {
  return t(`live.upload.err.${problem.problem}`);
}

const megabytes = (bytes: number, locale: Locale) =>
  new Intl.NumberFormat(localeTag(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1048576);

export { megabytes };

/** Progress, pauses and errors of the upload, under the studio's controls. */
export function UploadStatus({ view, announcement, onRetry, onDiscard }: { view: QueueView; announcement: string; onRetry(): void; onDiscard(): void }) {
  const { t, locale } = useI18n();
  const id = useId();
  const percent = view.total ? Math.min(100, Math.floor((view.sent / view.total) * 100)) : 0;
  const canRetry = view.phase === 'paused' || (view.phase === 'failed' && Boolean(view.problem?.retryable));
  return (
    <>
      <p className="visually-hidden" role="status" aria-live="polite" data-testid="upload-announcement">{announcement}</p>
      {view.phase === 'idle' ? null : (
        <section className="upload-status" aria-labelledby={`${id}-title`} data-testid="upload-status" data-phase={view.phase}>
          <h3 id={`${id}-title`} className="upload-status__title">{t('live.upload.title')}</h3>
          {view.phase === 'done' ? (
            <p className="hint"><Icon name="check" size={16} /> {t('live.upload.done', { title: view.title })}</p>
          ) : (
            <>
              <label htmlFor={`${id}-bar`} className="upload-status__line">
                <span dir="auto">{t('live.upload.label', { title: view.title })}</span>
                <span className="ltr" data-testid="upload-progress-text">
                  {t('live.upload.progress', { percent, sent: megabytes(view.sent, locale), total: megabytes(view.total, locale) })}
                </span>
              </label>
              <progress id={`${id}-bar`} className="progress" max={100} value={percent} data-testid="upload-progress" />
              {view.phase === 'address' ? <p className="hint"><span className="spinner" aria-hidden="true" /> {t('live.upload.preparing')}</p> : null}
              {view.phase === 'finishing' ? <p className="hint"><span className="spinner" aria-hidden="true" /> {t('live.upload.finishing')}</p> : null}
              {view.phase === 'sending' && view.retryIn !== null ? <p className="hint hint--warn">{t('live.upload.retrying', { seconds: view.retryIn })}</p> : null}
              {view.problem && (view.phase === 'paused' || view.phase === 'failed') ? (
                <p className="form__error" data-testid="upload-problem"><Icon name="alert" size={16} /><span>{problemText(t, view.problem)}</span></p>
              ) : null}
              {view.phase === 'paused' || view.phase === 'failed' ? (
                <div className="upload-status__actions">
                  {canRetry ? (
                    <button type="button" className="btn btn--gold btn--sm" onClick={onRetry} data-testid="upload-retry">
                      <Icon name="check" size={16} />
                      <span>{t('live.upload.retry')}</span>
                    </button>
                  ) : null}
                  <button type="button" className="btn btn--ghost-danger btn--sm" onClick={onDiscard} data-testid="upload-discard">
                    <Icon name="trash" size={16} />
                    <span>{t('live.upload.discard')}</span>
                  </button>
                </div>
              ) : <p className="hint">{t('live.upload.leave')}</p>}
            </>
          )}
          {view.waiting > 0 ? <p className="hint">{t('live.upload.queued', { n: view.waiting })}</p> : null}
        </section>
      )}
    </>
  );
}

/** Recordings left on this device by an earlier visit (a closed tab, a lost connection): upload or discard. */
export function UnfinishedRecordings({ items, disabled, timeZone, onUpload, onDiscard }: {
  items: LocalRecording[];
  disabled: boolean;
  timeZone: string;
  onUpload(meta: LocalRecording): void;
  onDiscard(meta: LocalRecording): void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  if (items.length === 0) return null;
  return (
    <section className="alert alert--warn unfinished" aria-labelledby={`${id}-title`} data-testid="unfinished-recordings">
      <Icon name="alert" size={20} />
      <div className="alert__body">
        <h2 id={`${id}-title`} className="strong">{t('live.unfinished.title')}</h2>
        <p>{t('live.unfinished.text')}</p>
        <ul className="unfinished__list">
          {items.map((item) => (
            <li key={item.localId} className="unfinished__item">
              <span className="strong" dir="auto">{item.title}</span>
              <span className="unfinished__meta">
                {t('live.unfinished.meta', {
                  date: formatDateTime(new Date(item.startedAt).toISOString(), locale, timeZone),
                  size: megabytes(item.sizeBytes, locale),
                  duration: formatElapsed(item.durationSeconds * 1000),
                })}
              </span>
              <span className="upload-status__actions">
                <button type="button" className="btn btn--gold btn--sm" disabled={disabled} onClick={() => onUpload(item)} aria-label={t('live.unfinished.uploadLabel', { title: item.title })} data-testid="unfinished-upload">
                  <Icon name="download" size={16} className="icon icon--up" />
                  <span>{t('live.unfinished.upload')}</span>
                </button>
                <button type="button" className="btn btn--ghost-danger btn--sm" onClick={() => onDiscard(item)} aria-label={t('live.unfinished.discardLabel', { title: item.title })} data-testid="unfinished-discard">
                  <Icon name="trash" size={16} />
                  <span>{t('live.unfinished.discard')}</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
