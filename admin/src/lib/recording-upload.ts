// Sending a finished recording to Cloudflare (docs/LIVE.md "Recordings"):
//
//   1. an upload address from the API: POST /admin/live/recordings { sessionId, sizeBytes, durationSeconds, mimeType,
//      title } -> { recordingId, uploadUrl }. When the broadcast already has a recording (409 with `recording`, e.g.
//      after a crash in the middle of an upload) or this copy already knows its recording: POST /:id/upload-url for a
//      new address, from byte 0. A recording that is already processing or ready needs nothing more.
//   2. the file, straight to Cloudflare (lib/tus.ts); an expired address is renewed the same way;
//   3. POST /:id/uploaded -> the recording is "processing" (or already "ready");
//   4. the IndexedDB copy is deleted.
//
// The API never sees the video; the upload address is kept in memory only, for the length of this job.

import { isApiError, type Recording } from './api';
import type { LocalRecording, RecordingStore } from './recording-store';
import { TusError, TusUpload, type TusOptions } from './tus';

export type UploadAddress = { recordingId: string; uploadUrl: string; recording: Recording };

export type RecordingApi = {
  create(body: { sessionId: string; sizeBytes: number; durationSeconds: number; mimeType: string; title?: string }): Promise<UploadAddress>;
  renew(id: string, body: { sizeBytes: number; durationSeconds?: number; mimeType?: string }): Promise<UploadAddress>;
  uploaded(id: string): Promise<{ recording: Recording }>;
};

export type UploadPhase = 'address' | 'sending' | 'paused' | 'finishing' | 'done' | 'failed';

/** Why an upload stopped, in one word the page translates (live.upload.err.<reason>). */
export type UploadProblem = 'paused' | 'refused' | 'notYours' | 'gone' | 'notConfigured' | 'failedAtCloudflare' | 'empty' | 'other';

export class UploadStopped extends Error {
  readonly problem: UploadProblem;
  /** True when Retry can help (the network, Cloudflare or the API being busy). */
  readonly retryable: boolean;
  /** The API's own words for a 4xx, shown when there is no better translation. */
  readonly apiMessage: string | null;
  constructor(problem: UploadProblem, retryable: boolean, apiMessage: string | null = null) {
    super(`Upload stopped: ${problem}`);
    this.name = 'UploadStopped';
    this.problem = problem;
    this.retryable = retryable;
    this.apiMessage = apiMessage;
  }
}

/** The recording already reached Cloudflare (processing or ready): nothing left to send. */
export class AlreadyUploaded extends Error {
  readonly recording: Recording;
  constructor(recording: Recording) {
    super('This recording has already been uploaded.');
    this.name = 'AlreadyUploaded';
    this.recording = recording;
  }
}

/** An API failure, in words: network, busy and Cloudflare (5xx, 429) can be retried; a 4xx cannot. */
export function problemOf(error: unknown): UploadStopped {
  if (error instanceof UploadStopped) return error;
  if (error instanceof TusError) {
    if (error.kind === 'paused') return new UploadStopped('paused', true);
    if (error.kind === 'aborted') return new UploadStopped('other', true);
    return new UploadStopped('refused', true); // a new address and a fresh start can still work
  }
  if (isApiError(error)) {
    if (error.status === 403) return new UploadStopped('notYours', false, error.message);
    if (error.status === 404) return new UploadStopped('gone', false, error.message);
    if (error.status === 503) return new UploadStopped('notConfigured', false, error.message);
    if (error.status === 409) return new UploadStopped('failedAtCloudflare', true, error.message);
    if (error.status >= 500 || error.status === 429) return new UploadStopped('paused', true);
    return new UploadStopped('other', false, error.message);
  }
  return new UploadStopped('other', true);
}

const recordingOf = (body: unknown): Recording | null => {
  const r = (body as { recording?: Recording } | null)?.recording;
  return r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string' ? r : null;
};

export type UploadJobOptions = {
  meta: LocalRecording;
  blob: Blob;
  api: RecordingApi;
  store: RecordingStore | null;
  onPhase?: (phase: UploadPhase) => void;
  onProgress?: (sent: number, total: number) => void;
  tus?: Partial<TusOptions>;
};

export class RecordingUploadJob {
  meta: LocalRecording;
  phase: UploadPhase = 'address';
  private upload: TusUpload | null = null;
  private recordingId: string | null;
  private readonly options: UploadJobOptions;
  private aborted = false;

  constructor(options: UploadJobOptions) {
    this.options = options;
    this.meta = options.meta;
    this.recordingId = options.meta.recordingId;
  }

  get total() {
    return this.options.blob.size;
  }

  private setPhase(phase: UploadPhase) {
    this.phase = phase;
    this.options.onPhase?.(phase);
  }

  private body() {
    return { sizeBytes: this.total, durationSeconds: this.meta.durationSeconds, mimeType: this.meta.mimeType };
  }

  /** A fresh address: a new recording, or a renewed one when the API already has it. */
  private async address(): Promise<UploadAddress> {
    const { api } = this.options;
    const renew = async (id: string) => {
      try {
        return await api.renew(id, this.body());
      } catch (error) {
        const recording = isApiError(error) && error.status === 409 ? recordingOf(error.body) : null;
        if (recording && (recording.status === 'processing' || recording.status === 'ready')) throw new AlreadyUploaded(recording);
        throw error;
      }
    };
    if (this.recordingId) return renew(this.recordingId);
    try {
      return await api.create({ sessionId: this.meta.sessionId, ...this.body(), ...(this.meta.title ? { title: this.meta.title.slice(0, 120) } : {}) });
    } catch (error) {
      const existing = isApiError(error) && error.status === 409 ? recordingOf(error.body) : null;
      if (!existing) throw error;
      if (existing.status === 'processing' || existing.status === 'ready') throw new AlreadyUploaded(existing);
      this.recordingId = existing.id;
      return renew(existing.id);
    }
  }

  /**
   * Runs (or resumes, after a pause) the upload. Resolves with the recording ("processing" or "ready"). Throws
   * UploadStopped (with `retryable`); call run() again to retry: a paused upload continues where Cloudflare stopped.
   */
  async run(): Promise<Recording> {
    if (this.aborted) throw new UploadStopped('other', false);
    if (this.total < 1) throw new UploadStopped('empty', false);
    try {
      // Cloudflare already has every byte (the page died before telling the API): only say so.
      if (!this.upload && this.meta.state === 'sent' && this.recordingId) {
        this.setPhase('finishing');
        try {
          const { recording } = await this.options.api.uploaded(this.recordingId);
          return await this.finish(recording);
        } catch (error) {
          if (!(isApiError(error) && error.status === 409)) throw error;
          this.meta = { ...this.meta, state: 'uploading' }; // Cloudflare could not use it: send it again
        }
      }
      if (!this.upload) {
        this.setPhase('address');
        let first: UploadAddress;
        try {
          first = await this.address();
        } catch (error) {
          if (error instanceof AlreadyUploaded) return await this.finish(error.recording);
          throw error;
        }
        this.recordingId = first.recordingId;
        this.meta = { ...this.meta, recordingId: first.recordingId, state: 'uploading', updatedAt: Date.now() };
        await this.options.store?.putMeta(this.meta).catch(() => undefined); // never the address, only the id
        const id = first.recordingId;
        this.upload = new TusUpload({
          blob: this.options.blob,
          url: first.uploadUrl,
          renew: async () => (await this.options.api.renew(id, this.body())).uploadUrl,
          onProgress: this.options.onProgress,
          ...this.options.tus,
        });
      }
      this.setPhase('sending');
      await this.upload.run();
      this.meta = { ...this.meta, state: 'sent', updatedAt: Date.now() };
      await this.options.store?.putMeta(this.meta).catch(() => undefined);
      this.setPhase('finishing');
      const { recording } = await this.options.api.uploaded(this.recordingId!);
      return await this.finish(recording);
    } catch (error) {
      if (error instanceof TusError && error.kind === 'address') this.upload = null; // ask the API again next time
      if (isApiError(error) && error.status === 409 && this.phase === 'finishing') this.upload = null; // failed at Cloudflare: start over
      const problem = problemOf(error);
      this.setPhase(problem.retryable ? 'paused' : 'failed');
      throw problem;
    }
  }

  abort() {
    this.aborted = true;
    this.upload?.abort();
  }

  private async finish(recording: Recording): Promise<Recording> {
    await this.options.store?.remove(this.meta.localId).catch(() => undefined);
    this.setPhase('done');
    return recording;
  }
}
