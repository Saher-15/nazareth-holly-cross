// A small tus 1.0 client (https://tus.io/protocols/resumable-upload) for the recording of a broadcast: the browser sends
// the file STRAIGHT to Cloudflare Stream with the one-time address the API asked Cloudflare for (Direct Creator Upload,
// docs/LIVE.md "Recordings"). No dependency: XMLHttpRequest, because fetch() has no upload progress.
//
//   PATCH <address>   Tus-Resumable: 1.0.0, Upload-Offset: n, Content-Type: application/offset+octet-stream,
//                     body = the next piece of the file  ->  204 + Upload-Offset (the new offset)
//   HEAD  <address>   Tus-Resumable: 1.0.0                ->  200 + Upload-Offset (how much Cloudflare has)
//
// Pieces are a multiple of 256 KiB and at least 5 MiB (Cloudflare's rule), except the last one. A network failure or a
// 5xx is retried after a growing pause (2, 4, 8 ... 60 s), each time after asking Cloudflare (HEAD) how much it has;
// after `maxFailures` failures in a row the upload is "paused" (the page offers Retry). 404/410 (and 403) mean the
// address expired: `renew()` asks the API for a new one and the upload starts again from byte 0.
//
// The upload address lets anyone upload one video into the account until it is used: it lives in this object only,
// is never logged, never stored and never put in an error message. No cookie goes with it (withCredentials = false)
// and the page's Referrer-Policy (no-referrer) keeps the dashboard's address out of the request.

import { UPLOAD_HOSTS } from './api';

/** 8 MiB: 32 x 256 KiB, above Cloudflare's 5 MiB minimum, small enough to resume cheaply on a phone. */
export const TUS_CHUNK_BYTES = 8 * 1024 * 1024;
export const TUS_CHUNK_UNIT = 256 * 1024;
export const TUS_MIN_CHUNK = 5 * 1024 * 1024;
export const TUS_MAX_FAILURES = 6;
export const TUS_MAX_RENEWALS = 3;

export type TusErrorKind = 'paused' | 'expired' | 'fatal' | 'aborted' | 'address';

export class TusError extends Error {
  readonly kind: TusErrorKind;
  readonly status: number | null;
  constructor(kind: TusErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = 'TusError';
    this.kind = kind;
    this.status = status;
  }
}

export const isTusError = (value: unknown): value is TusError => value instanceof TusError;

/** The upload address, checked like the API checks it: https, one of Cloudflare's two upload hosts, plain path. */
export function checkUploadUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TusError('address', 'The upload address is not valid.');
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const ok = url.protocol === 'https:' && (UPLOAD_HOSTS as readonly string[]).includes(url.hostname) && !url.port && !url.username && !url.password
    && !url.hash && segments.length >= 1 && segments.length <= 4 && segments.every((s) => /^[A-Za-z0-9_-]{1,256}$/.test(s))
    && /^(\?[A-Za-z0-9_=&-]{0,200})?$/.test(url.search);
  if (!ok) throw new TusError('address', 'The upload address is not a Cloudflare upload address.');
  return url.toString();
}

/** A piece size Cloudflare accepts: a multiple of 256 KiB, at least 5 MiB. */
export function normalChunkSize(size: number): number {
  const units = Math.max(Math.ceil(TUS_MIN_CHUNK / TUS_CHUNK_UNIT), Math.floor(size / TUS_CHUNK_UNIT));
  return units * TUS_CHUNK_UNIT;
}

/** The end (exclusive) of the piece that starts at `offset`. */
export const chunkEnd = (offset: number, total: number, chunkSize: number) => Math.min(total, offset + chunkSize);

/** The pause before retry number `failures` (1, 2, 3 ...): 2, 4, 8, 16, 32, 60, 60 ... seconds. */
export const backoffMs = (failures: number) => Math.min(60_000, 2000 * 2 ** Math.max(0, failures - 1));

/** The 25/50/75/100 % mark crossed between two percentages (announced politely, at most every quarter), or null. */
export function crossedMilestone(before: number, after: number): number | null {
  const marks = [25, 50, 75, 100].filter((m) => before < m && after >= m);
  return marks.length ? marks[marks.length - 1] : null;
}

/** The parts of XMLHttpRequest this client uses (tests pass a fake). */
export type XhrLike = {
  open(method: string, url: string, async?: boolean): void;
  setRequestHeader(name: string, value: string): void;
  getResponseHeader(name: string): string | null;
  send(body?: Blob | null): void;
  abort(): void;
  status: number;
  timeout: number;
  withCredentials: boolean;
  upload: { onprogress: ((event: { loaded: number }) => void) | null } | null;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  ontimeout: (() => void) | null;
  onabort: (() => void) | null;
};

export type TusOptions = {
  blob: Blob;
  /** The one-time address from the API (checked here). */
  url: string;
  /** A new address when the old one expired (the API's /upload-url); the upload restarts from byte 0. */
  renew: () => Promise<string>;
  /** Bytes Cloudflare has (or is receiving), of `total`. */
  onProgress?: (sent: number, total: number) => void;
  /** Called before each pause, with the number of failures in a row and the pause (ms). */
  onRetry?: (failures: number, waitMs: number) => void;
  chunkSize?: number;
  maxFailures?: number;
  maxRenewals?: number;
  // Injectable for tests.
  createXhr?: () => XhrLike;
  wait?: (ms: number) => Promise<void>;
};

type Answer = { status: number; offset: number | null };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const PATCH_TIMEOUT_MS = 10 * 60_000;
const HEAD_TIMEOUT_MS = 30_000;

function parseOffset(value: string | null): number | null {
  if (value === null || !/^\d{1,15}$/.test(value.trim())) return null;
  return Number(value.trim());
}

/** 0 (network), 408, 423, 429 and 5xx are worth another try; 404, 410 and 403 mean the address expired. */
const retryable = (status: number) => status === 0 || status === 408 || status === 423 || status === 429 || status >= 500;
const expired = (status: number) => status === 403 || status === 404 || status === 410;

export class TusUpload {
  url: string;
  offset = 0;
  failures = 0;
  renewals = 0;
  private needsHead = false;
  private aborted = false;
  private current: XhrLike | null = null;
  private readonly options: TusOptions & Required<Pick<TusOptions, 'chunkSize' | 'maxFailures' | 'maxRenewals'>>;

  constructor(options: TusOptions) {
    this.url = checkUploadUrl(options.url);
    this.options = { chunkSize: TUS_CHUNK_BYTES, maxFailures: TUS_MAX_FAILURES, maxRenewals: TUS_MAX_RENEWALS, ...options };
    this.options.chunkSize = normalChunkSize(this.options.chunkSize);
  }

  get total(): number {
    return this.options.blob.size;
  }

  /**
   * Sends what Cloudflare does not have yet. Resolves when the last byte is accepted; throws a TusError: 'paused' after
   * too many failures in a row (call run() again to resume: it asks Cloudflare first), 'fatal' for a refusal that a
   * retry cannot fix, 'aborted' after abort(). Errors of renew() are passed through as they are.
   */
  async run(): Promise<void> {
    this.failures = 0;
    for (;;) {
      if (this.aborted) throw new TusError('aborted', 'The upload was stopped.');
      if (this.needsHead) {
        const head = await this.request('HEAD');
        if (head.status === 200 || head.status === 204) {
          if (head.offset !== null && head.offset <= this.total) this.offset = head.offset;
          this.needsHead = false;
          this.report(this.offset);
        } else if (expired(head.status)) {
          await this.renewAddress();
        } else if (retryable(head.status)) {
          await this.failed(head.status);
        } else {
          throw new TusError('fatal', `Cloudflare refused the upload (${head.status}).`, head.status);
        }
        continue;
      }
      if (this.offset >= this.total) return;

      const end = chunkEnd(this.offset, this.total, this.options.chunkSize);
      const sent = await this.request('PATCH', this.offset, end);
      if (sent.status === 204 || sent.status === 200) {
        const next = sent.offset ?? end;
        if (next < this.offset || next > this.total) {
          this.needsHead = true; // an answer that makes no sense: ask Cloudflare where it stands
          await this.failed(sent.status);
          continue;
        }
        this.offset = next;
        this.failures = 0;
        this.report(this.offset);
      } else if (expired(sent.status)) {
        await this.renewAddress();
      } else if (sent.status === 409 || retryable(sent.status)) {
        // 409: the offset was not what Cloudflare has. Either way: pause, then ask how much arrived.
        this.needsHead = true;
        await this.failed(sent.status);
      } else {
        throw new TusError('fatal', `Cloudflare refused the upload (${sent.status}).`, sent.status);
      }
    }
  }

  /** Stops at once (the current request is cancelled). */
  abort() {
    this.aborted = true;
    try {
      this.current?.abort();
    } catch {
      // already finished
    }
  }

  private report(sent: number) {
    this.options.onProgress?.(Math.min(sent, this.total), this.total);
  }

  private async failed(status: number) {
    this.failures += 1;
    if (this.failures >= this.options.maxFailures) {
      this.needsHead = true;
      throw new TusError('paused', 'The upload is paused: check the connection.', status || null);
    }
    const ms = backoffMs(this.failures);
    this.options.onRetry?.(this.failures, ms);
    await (this.options.wait ?? sleep)(ms);
    this.needsHead = true;
  }

  private async renewAddress() {
    this.renewals += 1;
    if (this.renewals > this.options.maxRenewals) throw new TusError('expired', 'The upload address keeps expiring.');
    const fresh = await this.options.renew();
    this.url = checkUploadUrl(fresh);
    this.offset = 0;
    this.needsHead = false;
    this.failures = 0;
    this.report(0);
  }

  private request(method: 'PATCH' | 'HEAD', from = 0, to = 0): Promise<Answer> {
    return new Promise<Answer>((resolve, reject) => {
      const xhr = (this.options.createXhr ?? (() => new XMLHttpRequest() as unknown as XhrLike))();
      this.current = xhr;
      const done = (answer: Answer) => {
        this.current = null;
        resolve(answer);
      };
      xhr.open(method, this.url, true);
      xhr.withCredentials = false; // no cookie of ours ever goes to Cloudflare
      xhr.timeout = method === 'PATCH' ? PATCH_TIMEOUT_MS : HEAD_TIMEOUT_MS;
      xhr.setRequestHeader('Tus-Resumable', '1.0.0');
      if (method === 'PATCH') {
        xhr.setRequestHeader('Upload-Offset', String(from));
        xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream');
        if (xhr.upload) xhr.upload.onprogress = (event) => this.report(from + Math.min(event.loaded, to - from));
      }
      xhr.onload = () => done({ status: xhr.status, offset: parseOffset(xhr.getResponseHeader('Upload-Offset')) });
      xhr.onerror = () => done({ status: 0, offset: null });
      xhr.ontimeout = () => done({ status: 0, offset: null });
      xhr.onabort = () => {
        this.current = null;
        if (this.aborted) reject(new TusError('aborted', 'The upload was stopped.'));
        else resolve({ status: 0, offset: null });
      };
      if (this.aborted) {
        this.current = null;
        reject(new TusError('aborted', 'The upload was stopped.'));
        return;
      }
      xhr.send(method === 'PATCH' ? this.options.blob.slice(from, to) : null);
    });
  }
}
