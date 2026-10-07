// Recording a broadcast in the admin's browser (docs/LIVE.md "Recordings"). Cloudflare does not record WebRTC inputs,
// so the page records what it publishes, with MediaRecorder, and uploads the file after the broadcast (lib/tus.ts).
//
// The studio can switch the camera or the microphone while live: it opens a new track and STOPS the old one. A
// MediaRecorder bound to the original tracks would freeze or stop then, so it records a small "mixer" instead:
//
//   video  the preview <video> drawn onto a canvas (requestVideoFrameCallback, else requestAnimationFrame; a slow timer
//          keeps a frame coming when the tab is in the background), canvas.captureStream(30). The canvas has a fixed
//          size (the camera's, at most 1280 on the long side and 720 on the short one) and the picture is fitted into
//          it, so a camera switch or a phone turned sideways never changes the size of the file's video.
//   audio  WebAudio: the current microphone track -> a gain (0 while muted: silence is recorded) -> a
//          MediaStreamAudioDestinationNode. A microphone switch reconnects the source; the recorded track stays.
//
// The preview is mirrored by CSS only, so the canvas (and the recording) shows the scene the right way round, like the
// viewers see it. Without canvas.captureStream or AudioContext the raw camera/microphone tracks are recorded instead:
// then a camera or microphone switch while live ends that part of the recording (a documented limitation).

import type { LocalRecording, RecordingStore } from './recording-store';

export const RECORDER_TIMESLICE_MS = 4000;
export const RECORDER_VIDEO_BITS = 2_500_000;
export const RECORDER_AUDIO_BITS = 128_000;
export const RECORDER_FPS = 30;
const LONG_SIDE = 1280;
const SHORT_SIDE = 720;

const MP4 = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'];
const WEBM = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
/** The API accepts these (server/route/admin/liveRecordings.js). */
const ACCEPTED = /^video\/(mp4|webm|x-matroska)(;[ a-z0-9=.,"-]{0,80})?$/i;

/** WebKit (Safari, and every browser on an iPhone) records mp4 natively: prefer it there. */
export function prefersMp4(userAgent: string): boolean {
  return /AppleWebKit\//.test(userAgent) && !/(Chrome|Chromium|Edg|OPR|SamsungBrowser)\//.test(userAgent) && !/Android/.test(userAgent);
}

/** The first type this browser can record, in our order of preference; '' when none (the switch is then off). */
export function pickMimeType(isTypeSupported: ((type: string) => boolean) | undefined, preferMp4: boolean): string {
  if (!isTypeSupported) return '';
  for (const type of preferMp4 ? [...MP4, ...WEBM] : [...WEBM, ...MP4]) {
    try {
      if (isTypeSupported(type)) return type;
    } catch {
      // a browser that throws for an unknown type: try the next
    }
  }
  return '';
}

/** The type to tell the API: what the recorder says it wrote, when the API accepts that, else the base type. */
export function uploadMimeType(recorded: string | undefined, chosen: string): string {
  for (const candidate of [recorded ?? '', chosen]) {
    const clean = candidate.replace(/\s+/g, '').slice(0, 100);
    if (ACCEPTED.test(clean)) return clean;
    const base = /^video\/(mp4|webm|x-matroska)/i.exec(clean)?.[0];
    if (base) return base.toLowerCase();
  }
  return 'video/webm';
}

/** Whether this browser can record at all. */
export function recordingSupported(win: (Window & typeof globalThis) | undefined): boolean {
  return Boolean(win && typeof win.MediaRecorder === 'function');
}

/** The canvas size for a camera of `width` x `height`: at most 1280 on the long side, 720 on the short one, even. */
export function canvasSize(width?: number, height?: number): { width: number; height: number } {
  const w = width && width > 0 ? width : LONG_SIDE;
  const h = height && height > 0 ? height : SHORT_SIDE;
  const scale = Math.min(1, LONG_SIDE / Math.max(w, h), SHORT_SIDE / Math.min(w, h));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(w), height: even(h) };
}

/** Where a `source` picture goes inside a `box`, kept whole and centred ("contain"). */
export function containRect(source: { width: number; height: number }, box: { width: number; height: number }) {
  if (!source.width || !source.height) return { x: 0, y: 0, width: box.width, height: box.height };
  const scale = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

// ---------------------------------------------------------------- the mixer

type Context2DLike = {
  fillStyle: unknown;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: unknown, x: number, y: number, width: number, height: number): void;
};

type CanvasLike = {
  width: number;
  height: number;
  getContext(kind: '2d'): Context2DLike | null;
  captureStream?: (fps?: number) => MediaStream;
};

type VideoLike = Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight' | 'readyState'> & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export type MixerDeps = {
  createCanvas?: () => CanvasLike;
  AudioContextCtor?: (new () => AudioContext) | undefined;
  MediaStreamCtor?: new (tracks?: MediaStreamTrack[]) => MediaStream;
  requestFrame?: (cb: () => void) => number;
  cancelFrame?: (handle: number) => void;
  setInterval?: (cb: () => void, ms: number) => number;
  clearInterval?: (handle: number) => void;
  now?: () => number;
};

export type MixerMode = { video: 'canvas' | 'direct'; audio: 'webaudio' | 'direct' | 'none' };

export class RecorderMixer {
  readonly stream: MediaStream;
  readonly mode: MixerMode;
  private readonly video: VideoLike;
  private readonly deps: Required<Omit<MixerDeps, 'AudioContextCtor'>> & Pick<MixerDeps, 'AudioContextCtor'>;
  private canvas: CanvasLike | null = null;
  private context: ReturnType<CanvasLike['getContext']> = null;
  private audio: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private videoHandle: number | null = null;
  private frameHandle: number | null = null;
  private timer: number | null = null;
  private lastDraw = 0;
  private disposed = false;

  /**
   * `video`: the preview element (it always shows the current camera). `source`: the current camera + microphone
   * stream. Create it inside the click that starts the broadcast: browsers start an AudioContext only after a gesture.
   */
  constructor(video: VideoLike, source: MediaStream, { muted = false, ...deps }: MixerDeps & { muted?: boolean } = {}) {
    const g = globalThis as typeof globalThis & { webkitAudioContext?: new () => AudioContext };
    this.video = video;
    this.deps = {
      createCanvas: deps.createCanvas ?? (() => document.createElement('canvas') as unknown as CanvasLike),
      AudioContextCtor: 'AudioContextCtor' in deps ? deps.AudioContextCtor : (g.AudioContext ?? g.webkitAudioContext),
      MediaStreamCtor: deps.MediaStreamCtor ?? MediaStream,
      requestFrame: deps.requestFrame ?? ((cb) => requestAnimationFrame(cb)),
      cancelFrame: deps.cancelFrame ?? ((h) => cancelAnimationFrame(h)),
      setInterval: deps.setInterval ?? ((cb, ms) => window.setInterval(cb, ms)),
      clearInterval: deps.clearInterval ?? ((h) => window.clearInterval(h)),
      now: deps.now ?? (() => performance.now()),
    };

    // ---- video: a canvas that follows the preview element
    let videoTrack: MediaStreamTrack | undefined;
    let videoMode: MixerMode['video'] = 'direct';
    try {
      const canvas = this.deps.createCanvas();
      const settings = source.getVideoTracks()[0]?.getSettings?.() ?? {};
      Object.assign(canvas, canvasSize(settings.width, settings.height));
      const context = canvas.getContext('2d');
      if (context && typeof canvas.captureStream === 'function') {
        this.canvas = canvas;
        this.context = context;
        this.draw();
        videoTrack = canvas.captureStream(RECORDER_FPS).getVideoTracks()[0];
        if (videoTrack) videoMode = 'canvas';
      }
    } catch {
      videoTrack = undefined;
    }
    if (videoMode === 'canvas') this.loop();
    else {
      this.canvas = null;
      this.context = null;
      videoTrack = source.getVideoTracks()[0];
    }

    // ---- audio: WebAudio, so the microphone can change under the recorder
    let audioTrack: MediaStreamTrack | undefined;
    let audioMode: MixerMode['audio'] = 'none';
    const Ctor = this.deps.AudioContextCtor;
    if (Ctor) {
      try {
        const audio = new Ctor();
        const destination = audio.createMediaStreamDestination();
        const gain = audio.createGain();
        gain.gain.value = muted ? 0 : 1;
        gain.connect(destination);
        this.audio = audio;
        this.gain = gain;
        audioTrack = destination.stream.getAudioTracks()[0];
        audioMode = 'webaudio';
        this.connect(source);
        void audio.resume?.().catch(() => undefined);
      } catch {
        this.audio = null;
        this.gain = null;
      }
    }
    if (audioMode === 'none' && source.getAudioTracks()[0]) {
      audioTrack = source.getAudioTracks()[0];
      audioMode = 'direct';
    }

    this.mode = { video: videoMode, audio: audioMode };
    this.stream = new this.deps.MediaStreamCtor([videoTrack, audioTrack].filter((t): t is MediaStreamTrack => Boolean(t)));
  }

  /** The camera or the microphone changed: the recorded audio follows the new microphone (the video follows by itself). */
  setSource(source: MediaStream) {
    if (this.disposed) return;
    if (this.audio) this.connect(source);
    if (this.canvas && this.videoHandle === null && this.frameHandle === null) this.loop();
  }

  setMuted(muted: boolean) {
    if (this.gain) this.gain.gain.value = muted ? 0 : 1;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.videoHandle !== null) this.video.cancelVideoFrameCallback?.(this.videoHandle);
    if (this.frameHandle !== null) this.deps.cancelFrame(this.frameHandle);
    if (this.timer !== null) this.deps.clearInterval(this.timer);
    this.videoHandle = null;
    this.frameHandle = null;
    this.timer = null;
    try {
      this.source?.disconnect();
    } catch {
      // already disconnected
    }
    void this.audio?.close?.().catch(() => undefined);
    if (this.mode.video === 'canvas') for (const track of this.stream.getVideoTracks()) track.stop();
  }

  private connect(source: MediaStream) {
    if (!this.audio || !this.gain) return;
    try {
      this.source?.disconnect();
    } catch {
      // already disconnected
    }
    this.source = null;
    const track = source.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') return;
    try {
      this.source = this.audio.createMediaStreamSource(new this.deps.MediaStreamCtor([track]));
      this.source.connect(this.gain);
    } catch {
      this.source = null; // silence until the next microphone
    }
  }

  private draw() {
    const { canvas, context, video } = this;
    if (!canvas || !context) return;
    this.lastDraw = this.deps.now();
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      const r = containRect({ width: video.videoWidth, height: video.videoHeight }, canvas);
      try {
        context.drawImage(video, r.x, r.y, r.width, r.height);
      } catch {
        // a frame that cannot be drawn (the camera is switching): the black frame stays
      }
    }
  }

  private loop() {
    const next = () => {
      if (this.disposed) return;
      this.videoHandle = null;
      this.frameHandle = null;
      this.draw();
      schedule();
    };
    const schedule = () => {
      if (this.disposed) return;
      if (typeof this.video.requestVideoFrameCallback === 'function') this.videoHandle = this.video.requestVideoFrameCallback(next);
      else this.frameHandle = this.deps.requestFrame(next);
    };
    schedule();
    // Frames stop coming in a background tab (and for a moment while the camera switches): draw at least now and then,
    // and start the frame callbacks again if they were lost.
    if (this.timer === null) {
      this.timer = this.deps.setInterval(() => {
        if (this.disposed || this.deps.now() - this.lastDraw < 400) return;
        this.draw();
        if (this.videoHandle !== null) this.video.cancelVideoFrameCallback?.(this.videoHandle);
        if (this.frameHandle !== null) this.deps.cancelFrame(this.frameHandle);
        this.videoHandle = null;
        this.frameHandle = null;
        schedule();
      }, 500);
    }
  }
}

// ---------------------------------------------------------------- the recorder

type RecorderLike = {
  readonly state: 'inactive' | 'recording' | 'paused';
  readonly mimeType?: string;
  start(timeslice?: number): void;
  stop(): void;
  addEventListener(type: 'dataavailable', listener: (event: { data: Blob }) => void): void;
  addEventListener(type: 'stop' | 'error', listener: () => void): void;
};

export type RecorderCtor = new (stream: MediaStream, options?: MediaRecorderOptions) => RecorderLike;

export type BroadcastRecorderOptions = {
  stream: MediaStream;
  mimeType: string;
  meta: Pick<LocalRecording, 'localId' | 'sessionId' | 'userId' | 'title'>;
  /** The IndexedDB copy, or null (memory only). */
  store: RecordingStore | null;
  /** Something changed (size, a store problem): the page re-renders its "Recording" line. */
  onChange?: () => void;
  RecorderCtor?: RecorderCtor;
  now?: () => number;
  timeslice?: number;
};

/**
 * One broadcast's recording: MediaRecorder with a timeslice, every piece kept in memory AND written to IndexedDB in
 * order (a write failure, e.g. the quota, stops the copy but never the recording), the bookkeeping the upload needs.
 */
export class BroadcastRecorder {
  meta: LocalRecording;
  readonly chunks: Blob[] = [];
  /** False once a write to IndexedDB failed (or there is no IndexedDB): the recording then lives in memory only. */
  persisted: boolean;
  private recorder: RecorderLike | null = null;
  private queue: Promise<void> = Promise.resolve();
  private stopped: Promise<void> | null = null;
  private readonly options: BroadcastRecorderOptions;
  private readonly now: () => number;

  constructor(options: BroadcastRecorderOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    const at = this.now();
    this.meta = {
      ...options.meta,
      mimeType: uploadMimeType(undefined, options.mimeType),
      startedAt: at,
      endedAt: at,
      durationSeconds: 0,
      sizeBytes: 0,
      chunkCount: 0,
      state: 'recording',
      recordingId: null,
      updatedAt: at,
    };
    this.persisted = Boolean(options.store);
  }

  get sizeBytes() {
    return this.meta.sizeBytes;
  }

  /** Starts recording (and writes the first description to IndexedDB). Throws when the browser refuses. */
  start() {
    const Ctor = this.options.RecorderCtor ?? (globalThis as unknown as { MediaRecorder: RecorderCtor }).MediaRecorder;
    const recorder = new Ctor(this.options.stream, {
      ...(this.options.mimeType ? { mimeType: this.options.mimeType } : {}),
      videoBitsPerSecond: RECORDER_VIDEO_BITS,
      audioBitsPerSecond: RECORDER_AUDIO_BITS,
    });
    recorder.addEventListener('dataavailable', (event) => this.add(event.data));
    recorder.addEventListener('error', () => {
      // The browser gave up (e.g. a track it could not encode): keep what was recorded so far.
      void this.stop();
    });
    this.recorder = recorder;
    recorder.start(this.options.timeslice ?? RECORDER_TIMESLICE_MS);
    this.meta = { ...this.meta, mimeType: uploadMimeType(recorder.mimeType, this.options.mimeType) };
    this.persist(() => this.options.store!.putMeta(this.meta));
  }

  /** Stops, waits for the last piece and the writes, and returns the whole file. Safe to call twice. */
  async stop(): Promise<Blob> {
    if (!this.stopped) {
      const recorder = this.recorder;
      this.stopped = new Promise<void>((resolve) => {
        if (!recorder || recorder.state === 'inactive') return resolve();
        const timeout = setTimeout(resolve, 3000); // a recorder that never says "stop"
        recorder.addEventListener('stop', () => { clearTimeout(timeout); resolve(); });
        try {
          recorder.stop();
        } catch {
          clearTimeout(timeout);
          resolve();
        }
      }).then(() => {
        this.meta = { ...this.meta, state: 'stopped', endedAt: this.now(), durationSeconds: this.duration(), updatedAt: this.now() };
        this.persist(() => this.options.store!.putMeta(this.meta));
      });
    }
    await this.stopped;
    await this.queue;
    return this.blob();
  }

  /** The file so far (what is in memory). */
  blob(): Blob {
    return new Blob(this.chunks, { type: this.meta.mimeType });
  }

  private duration() {
    return Math.min(21_600, Math.max(0, Math.round((this.now() - this.meta.startedAt) / 1000)));
  }

  private add(data: Blob | undefined) {
    if (!data || data.size === 0) return;
    const index = this.chunks.length;
    this.chunks.push(data);
    const at = this.now();
    this.meta = { ...this.meta, chunkCount: index + 1, sizeBytes: this.meta.sizeBytes + data.size, endedAt: at, durationSeconds: this.duration(), updatedAt: at };
    const meta = this.meta;
    this.persist(async () => {
      await this.options.store!.putChunk(meta.localId, index, data);
      await this.options.store!.putMeta(meta);
    });
    this.options.onChange?.();
  }

  /** Writes in order; the first failure ends the copy (it stays a whole prefix of the file) and says so once. */
  private persist(write: () => Promise<void>) {
    if (!this.persisted || !this.options.store) return;
    this.queue = this.queue.then(async () => {
      if (!this.persisted) return;
      try {
        await write();
      } catch {
        this.persisted = false;
        this.options.onChange?.();
      }
    });
  }
}
