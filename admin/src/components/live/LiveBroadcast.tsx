'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { useI18n } from '@/i18n/client';
import { isApiError, liveStartSchema, liveStopSchema, type LiveSession } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { internalHref } from '@/lib/links';
import { audioConstraints, listDevices, mediaProblem, mediaSupportProblem, stopStream, videoConstraints, type Device, type Facing, type MediaProblem } from '@/lib/media';
import { BroadcastRecorder, pickMimeType, prefersMp4, RecorderMixer, recordingSupported } from '@/lib/recorder';
import { askPersistentStorage, holdRecordingLock, openRecordingStore, type RecordingStore } from '@/lib/recording-store';
import { holdSession } from '@/lib/session-hold';
import { WhipPublisher, type WhipState } from '@/lib/whip';
import { useUploadQueue, type QueueView, type UploadItem, type UploadQueue } from '@/app/(app)/live/RecordingUploads';

// The live broadcast of this browser tab (docs/LIVE.md), kept by the dashboard's layout so that it survives moving
// between dashboard pages: the camera stream, the WHIP connection to Cloudflare, the recorder (and its mixer), the
// screen wake lock and the recording uploads all live here, NOT in the Live page. The Live page (LiveStudio.tsx) is
// only the controls; every other page shows a compact bar (LiveBar.tsx) while a broadcast is on.
//
// Why it is safe: a page reached by client-side navigation keeps the Permissions-Policy and the Content-Security-Policy
// of the page the browser LOADED. A broadcast can only start on /live (the camera is allowed only there, docs/LIVE.md
// section 3), so while one is on, the document is the /live one and keeps its camera, WHIP and upload permissions on
// every other dashboard page. The menu then opens /live without a reload (AppShell).
//
// What still ends it: closing or reloading the tab, a full page load (the browser asks first: beforeunload; a keepalive
// "stop" is sent when the page goes), signing out (asks first), and leaving the dashboard's layout (the provider's
// cleanup stops it, as the Live page used to). While the sign-in has ended, links are held back (see the click guard).
//
// The recorder draws the camera from a <video> element. That element must keep playing while the admin is on another
// page, so it is created once here and MOVED between "slots": the studio's big preview, the bar's thumbnail, or a tiny
// parking place in between (a <video> removed from the page pauses).

export type LivePhase = 'off' | 'opening' | 'preview' | 'starting' | 'live' | 'ending';
export type RecordSupport = 'unknown' | 'yes' | 'no';
export type LiveError = { text: string; reload?: boolean };
export type GoLiveOptions = { title: string; scheduleId: string; record: boolean };

type WakeLockSentinelLike = { release(): Promise<void> };

export type LiveBroadcastValue = {
  phase: LivePhase;
  /** On air (or ending): the bar shows, the session is held, leaving the tab asks first. */
  isLive: boolean;
  /** Something is running that needs this tab's /live document: the camera, a broadcast, or an upload. */
  active: boolean;
  stream: MediaStream | null;
  cameras: Device[];
  microphones: Device[];
  videoId: string;
  audioId: string;
  hasAudio: boolean;
  muted: boolean;
  mirrored: boolean;
  error: LiveError | null;
  setError(error: LiveError | null): void;
  session: LiveSession | null;
  whipState: WhipState;
  liveSince: number | null;
  announcement: string;
  recordSupport: RecordSupport;
  recordingInfo: { size: number; persisted: boolean } | null;
  store: RecordingStore | null;
  queue: UploadQueue;
  uploadView: QueueView;
  uploadAnnouncement: string;
  ensureStore(): Promise<RecordingStore | null>;
  openCamera(): Promise<boolean>;
  closeCamera(): void;
  chooseCamera(id: string): Promise<void>;
  chooseMicrophone(id: string): Promise<void>;
  switchCamera(): Promise<void>;
  toggleMute(): void;
  goLive(options: GoLiveOptions): Promise<boolean>;
  /** Asks first, then ends this tab's broadcast. Resolves true when it ended. */
  endBroadcast(): Promise<boolean>;
  /** Before signing out: asks first when live and ends the broadcast. Resolves false when the admin stays. */
  confirmLeave(): Promise<boolean>;
  /** The studio is on screen (it returns the function to call when it goes). */
  registerStudio(): () => void;
  /** Puts the camera preview into `slot` (returns the function that takes it out again). */
  attachPreview(slot: HTMLElement, options: { label: string; testId?: string; className: string }): () => void;
};

const LiveBroadcastContext = createContext<LiveBroadcastValue | null>(null);

export function useLiveBroadcast(): LiveBroadcastValue {
  const value = useContext(LiveBroadcastContext);
  if (!value) throw new Error('useLiveBroadcast needs <LiveBroadcastProvider>');
  return value;
}

/** The same, or null outside the provider (the shell's pieces that also render on their own in tests). */
export const useOptionalLiveBroadcast = () => useContext(LiveBroadcastContext);

/** The clock and a fresh id, for event handlers (never called while rendering). */
const clock = () => Date.now();
const newLocalId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${clock()}-${Math.random().toString(16).slice(2)}`);

/** "stop" that survives the page being closed: keepalive, same-origin, through the BFF like every other call. */
export function sendStopBeacon(sessionId: string) {
  try {
    void fetch('/api/proxy/live/stop', {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => undefined);
  } catch {
    // the page is going away; the server's automatic end is the safety net
  }
}

/** The preview element shows `stream` (muted + playsInline: allowed to play without a gesture). */
function showStream(video: HTMLVideoElement, stream: MediaStream | null) {
  video.srcObject = stream;
  if (stream) void video.play().catch(() => undefined);
}

export function LiveBroadcastProvider({ userId, expiresAt, children }: { userId: string; expiresAt: number | null; children: ReactNode }) {
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const streamRef = useRef<MediaStream | null>(null);
  const publisherRef = useRef<WhipPublisher | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const mixerRef = useRef<RecorderMixer | null>(null);
  const recorderRef = useRef<BroadcastRecorder | null>(null);
  const lockRef = useRef<(() => void) | null>(null);
  const storeRef = useRef<RecordingStore | null>(null);
  const storePromise = useRef<Promise<RecordingStore | null> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const parkingRef = useRef<HTMLDivElement>(null);
  const studios = useRef(0);
  const phaseRef = useRef<LivePhase>('off');
  const mutedRef = useRef(false);

  const [phase, setPhaseState] = useState<LivePhase>('off');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<Device[]>([]);
  const [microphones, setMicrophones] = useState<Device[]>([]);
  const [videoId, setVideoId] = useState('');
  const [audioId, setAudioId] = useState('');
  const [facing, setFacing] = useState<Facing>('user');
  const [muted, setMutedState] = useState(false);
  const [hasAudio, setHasAudio] = useState(true);
  const [error, setError] = useState<LiveError | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [whipState, setWhipState] = useState<WhipState>('idle');
  const [liveSince, setLiveSince] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [recordSupport, setRecordSupport] = useState<RecordSupport>('unknown');
  const [recordMime, setRecordMime] = useState('');
  const [recordingInfo, setRecordingInfo] = useState<{ size: number; persisted: boolean } | null>(null);
  const [store, setStore] = useState<RecordingStore | null>(null);
  const { queue, view: uploadView, announcement: uploadAnnouncement } = useUploadQueue(store);

  /** The phase now (a read TypeScript does not narrow across awaits). */
  const readPhase = useCallback((): LivePhase => phaseRef.current, []);
  const setPhase = useCallback((next: LivePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const setMuted = (next: boolean) => {
    mutedRef.current = next;
    setMutedState(next);
  };

  const isLive = phase === 'live' || phase === 'ending';
  const uploading = uploadView.phase !== 'idle' && uploadView.phase !== 'done';
  const active = Boolean(stream) || phase !== 'off' || uploading || uploadView.waiting > 0;

  // ---- the preview element (one for the whole tab; see the header)
  const getVideo = useCallback(() => {
    if (!videoRef.current) {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      videoRef.current = video;
    }
    return videoRef.current;
  }, []);

  useEffect(() => {
    const video = videoRef.current ?? (stream ? getVideo() : null);
    if (video) showStream(video, stream);
  }, [stream, getVideo]);

  const attachPreview = useCallback((slot: HTMLElement, options: { label: string; testId?: string; className: string }) => {
    const video = getVideo();
    video.className = options.className;
    video.setAttribute('aria-label', options.label);
    if (options.testId) video.dataset.testid = options.testId;
    else delete video.dataset.testid;
    slot.appendChild(video);
    if (video.srcObject) void video.play().catch(() => undefined);
    return () => {
      // Back to the parking place (never out of the page: a <video> taken out of the document pauses).
      if (video.parentElement === slot && parkingRef.current) {
        parkingRef.current.appendChild(video);
        video.className = 'live-parking__video';
        video.removeAttribute('aria-label');
        delete video.dataset.testid;
        if (video.srcObject) void video.play().catch(() => undefined);
      }
    };
  }, [getVideo]);

  const mirrored = (() => {
    const settings = stream?.getVideoTracks()[0]?.getSettings?.();
    return settings?.facingMode !== 'environment';
  })();

  // ---- the browser's copy of recordings (IndexedDB), opened the first time it is needed
  const ensureStore = useCallback(() => {
    storePromise.current ??= openRecordingStore().then((opened) => {
      storeRef.current = opened;
      setStore(opened);
      return opened;
    });
    return storePromise.current;
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = listDevices(await navigator.mediaDevices.enumerateDevices(), (kind, n) => t(kind === 'camera' ? 'live.cameraN' : 'live.microphoneN', { n }));
      setCameras(list.cameras);
      setMicrophones(list.microphones);
    } catch {
      // the lists stay as they were
    }
  }, [t]);

  const releaseWakeLock = useCallback(() => {
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  /** Stops the recorder (its last piece and writes), frees the mixer, and gives the file for upload. */
  const finishRecording = useCallback(async (): Promise<UploadItem | null> => {
    const recorder = recorderRef.current;
    const mixer = mixerRef.current;
    recorderRef.current = null;
    mixerRef.current = null;
    if (!recorder) {
      mixer?.dispose();
      return null;
    }
    const blob = await recorder.stop();
    mixer?.dispose();
    const release = lockRef.current;
    lockRef.current = null;
    return { meta: recorder.meta, blob, release };
  }, []);

  const releaseCamera = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  // ---- leaving the dashboard's layout (sign-in page, a crash of the shell): end everything, as the page used to
  useEffect(() => {
    return () => {
      const live = sessionRef.current;
      if (live) sendStopBeacon(live.id);
      void publisherRef.current?.stop({ keepalive: true });
      publisherRef.current = null;
      sessionRef.current = null;
      void finishRecording().then((item) => { if (item) queue.add(item); });
      stopStream(streamRef.current);
      streamRef.current = null;
      void wakeLockRef.current?.release().catch(() => undefined);
    };
  }, [finishRecording, queue]);

  // ---- while on air: the session is held, leaving the tab asks first, the screen stays on
  const holding = isLive || phase === 'starting';
  useEffect(() => (holding ? holdSession() : undefined), [holding]);

  useEffect(() => {
    if (!isLive) return;
    // Closing the tab, reloading, or the phone killing the page: try to end the broadcast at once.
    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return; // kept in the back/forward cache: the page may come back
      const live = sessionRef.current;
      if (live) sendStopBeacon(live.id);
      void publisherRef.current?.stop({ keepalive: true });
    };
    // A last "are you sure?" before the browser leaves the page (the browser shows its own text).
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    // The screen stays on while broadcasting (a phone that locks itself stops the camera); asked again when the page
    // comes back to the front, because the browser drops the lock when it is hidden.
    const keepAwake = async () => {
      const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
      if (!wakeLock || document.visibilityState !== 'visible' || wakeLockRef.current) return;
      try {
        wakeLockRef.current = await wakeLock.request('screen');
      } catch {
        // not allowed (battery saver): the admin keeps the screen on by hand
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        wakeLockRef.current = null;
        void keepAwake();
      }
    };
    void keepAwake();
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseWakeLock();
    };
  }, [isLive, releaseWakeLock]);

  // ---- while on air and the sign-in has ended: a link would load a page that sends the browser to the sign-in page,
  // out of the dashboard's layout, which ends the broadcast. Links wait until the sign-in is good again.
  const expiresRef = useRef(expiresAt);
  useEffect(() => {
    expiresRef.current = expiresAt;
  }, [expiresAt]);
  useEffect(() => {
    if (!isLive) return;
    const onClick = (event: MouseEvent) => {
      const expires = expiresRef.current;
      if (!expires || clock() < expires) return;
      const href = internalHref(event, window.location.origin);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      void (async () => {
        let ok = false;
        try {
          ok = (await fetch('/api/proxy/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' })).ok;
        } catch {
          ok = false;
        }
        if (ok) {
          expiresRef.current = null; // signed in again (in another tab): the next page brings the new end time
          router.push(href);
        } else {
          toast(t('live.bar.signInFirst'), 'error');
        }
      })();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isLive, router, t, toast]);

  useEffect(() => {
    if (!stream) return;
    const onChange = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
  }, [stream, refreshDevices]);

  // ---- the WHIP connection, in words (announced politely to screen readers)
  const onWhipState = useCallback((state: WhipState) => {
    setWhipState(state);
    if (state === 'connected') setAnnouncement(t('live.onAir'));
    else if (state === 'reconnecting') setAnnouncement(t('live.reconnecting'));
    else if (state === 'failed') setAnnouncement(t('live.failed'));
  }, [t]);

  const showMediaProblem = useCallback((problem: MediaProblem) => {
    setError({ text: t(`live.err.${problem}`), reload: problem === 'blockedByPolicy' });
  }, [t]);

  const refreshLivePage = useCallback(() => {
    if (pathnameRef.current === '/live') router.refresh();
  }, [router]);

  // ---- camera
  const openCamera = useCallback(async () => {
    if (phaseRef.current !== 'off') return false;
    const problem = mediaSupportProblem(window);
    if (problem) {
      showMediaProblem(problem);
      return false;
    }
    setPhase('opening');
    setError(null);
    let media: MediaStream;
    let audio = true;
    try {
      media = await navigator.mediaDevices.getUserMedia({ video: videoConstraints({ facing }), audio: audioConstraints({}) });
    } catch (first) {
      // No microphone at all: a silent broadcast is still possible.
      if (mediaProblem(first) !== 'notFound') {
        setPhase('off');
        showMediaProblem(mediaProblem(first));
        return false;
      }
      try {
        media = await navigator.mediaDevices.getUserMedia({ video: videoConstraints({ facing }) });
        audio = false;
      } catch (second) {
        setPhase('off');
        showMediaProblem(mediaProblem(second));
        return false;
      }
    }
    const now = readPhase(); // the admin may have left the Live page while the browser was asking
    if (studios.current === 0 || now !== 'opening') {
      // Nothing should stay on.
      stopStream(media);
      if (now === 'opening') setPhase('off');
      return false;
    }
    streamRef.current = media;
    setStream(media);
    setHasAudio(audio);
    setMuted(false);
    setVideoId(media.getVideoTracks()[0]?.getSettings?.().deviceId ?? '');
    setAudioId(media.getAudioTracks()[0]?.getSettings?.().deviceId ?? '');
    setPhase('preview');
    const mime = recordingSupported(window) ? pickMimeType(window.MediaRecorder.isTypeSupported?.bind(window.MediaRecorder), prefersMp4(navigator.userAgent)) : '';
    setRecordMime(mime);
    setRecordSupport(mime ? 'yes' : 'no');
    await refreshDevices();
    return true;
  }, [facing, readPhase, refreshDevices, setPhase, showMediaProblem]);

  const closeCamera = useCallback(() => {
    if (phaseRef.current === 'live' || phaseRef.current === 'ending' || phaseRef.current === 'starting') return;
    releaseCamera();
    setPhase('off');
  }, [releaseCamera, setPhase]);

  /** A new camera or microphone: the old one is released first (a phone cannot open two cameras at once). */
  const replaceTrack = useCallback(async (kind: 'video' | 'audio', choice: { videoId?: string; audioId?: string; facing?: Facing }) => {
    const currentStream = streamRef.current;
    if (!currentStream) return false;
    const old = kind === 'video' ? currentStream.getVideoTracks()[0] : currentStream.getAudioTracks()[0];
    old?.stop();
    let fresh: MediaStream;
    try {
      fresh = await navigator.mediaDevices.getUserMedia(kind === 'video' ? { video: videoConstraints(choice) } : { audio: audioConstraints(choice) });
    } catch (e) {
      showMediaProblem(mediaProblem(e));
      return false;
    }
    const track = kind === 'video' ? fresh.getVideoTracks()[0] : fresh.getAudioTracks()[0];
    if (kind === 'audio') track.enabled = !mutedRef.current;
    const next = new MediaStream([...currentStream.getTracks().filter((tr) => tr.kind !== kind), track]);
    streamRef.current = next;
    setStream(next);
    setError(null);
    mixerRef.current?.setSource(next); // the recording follows the new microphone (and the preview's new camera)
    await publisherRef.current?.replaceTrack(track);
    return true;
  }, [showMediaProblem]);

  const chooseCamera = useCallback(async (id: string) => {
    setVideoId(id);
    await replaceTrack('video', { videoId: id });
  }, [replaceTrack]);

  const chooseMicrophone = useCallback(async (id: string) => {
    setAudioId(id);
    await replaceTrack('audio', { audioId: id });
  }, [replaceTrack]);

  const switchCamera = useCallback(async () => {
    const next: Facing = facing === 'user' ? 'environment' : 'user';
    if (await replaceTrack('video', { facing: next })) {
      setFacing(next);
      setVideoId(streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId ?? '');
    } else {
      await replaceTrack('video', { facing }); // back to the camera that worked
    }
  }, [facing, replaceTrack]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    for (const track of streamRef.current?.getAudioTracks() ?? []) track.enabled = !next;
    mixerRef.current?.setMuted(next); // silence is recorded while muted
    setMuted(next);
  }, []);

  // ---- going live and ending
  const message = useCallback((e: unknown, fallback: string) => (isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : fallback), []);

  /** The broadcast is on the air: record what it publishes, a piece every few seconds, to memory and IndexedDB. */
  const startRecording = useCallback((mixer: RecorderMixer, live: LiveSession, text: string) => {
    const localId = newLocalId();
    const recorder = new BroadcastRecorder({
      stream: mixer.stream,
      mimeType: recordMime,
      meta: { localId, sessionId: live.id, userId, title: text },
      store: storeRef.current,
      onChange: () => setRecordingInfo({ size: recorder.sizeBytes, persisted: recorder.persisted }),
    });
    try {
      recorder.start();
    } catch {
      mixer.dispose(); // the browser refused to record: the broadcast goes on without a recording
      return;
    }
    mixerRef.current = mixer;
    recorderRef.current = recorder;
    setRecordingInfo({ size: 0, persisted: recorder.persisted });
    askPersistentStorage();
    void holdRecordingLock(localId).then((release) => {
      if (recorderRef.current === recorder) lockRef.current = release;
      else release?.();
    });
  }, [recordMime, userId]);

  const goLive = useCallback(async ({ title, scheduleId, record }: GoLiveOptions) => {
    if (phaseRef.current !== 'preview' || !streamRef.current) return false;
    setError(null);
    // The recorder's mixer is made inside this click: browsers start WebAudio only after a gesture.
    let mixer: RecorderMixer | null = null;
    if (record && recordSupport === 'yes' && videoRef.current) {
      try {
        mixer = new RecorderMixer(videoRef.current, streamRef.current, { muted: mutedRef.current });
      } catch {
        mixer = null; // the broadcast goes ahead without a recording
      }
    }
    setPhase('starting');
    setAnnouncement(t('live.connecting'));

    let started;
    try {
      started = await proxyCall({ method: 'POST', path: 'live/start', body: { title, ...(scheduleId ? { scheduleId } : {}) }, schema: liveStartSchema });
    } catch (e) {
      mixer?.dispose();
      setPhase(streamRef.current ? 'preview' : 'off');
      setAnnouncement('');
      if (isApiError(e) && e.unauthorized) return false;
      // 404/409 about the scheduled broadcast (a busy 409 names the broadcast that is live: `current`).
      const busy = isApiError(e) && e.status === 409 && Boolean((e.body as { current?: unknown } | undefined)?.current);
      if (isApiError(e) && e.status === 404 && scheduleId) setError({ text: t('live.errScheduleGone') });
      else if (isApiError(e) && e.status === 409 && scheduleId && !busy) setError({ text: t('live.errScheduleState') });
      else if (isApiError(e) && e.status === 409) setError({ text: t('live.busy') });
      else if (isApiError(e) && e.status === 503) setError({ text: t('live.notConfiguredTitle') });
      else setError({ text: message(e, t('live.errStart')) });
      refreshLivePage();
      return false;
    }

    sessionRef.current = started.session;
    setSession(started.session);
    const publisher = new WhipPublisher({ url: started.whipUrl, stream: streamRef.current!, onState: onWhipState });
    publisherRef.current = publisher;
    try {
      await publisher.start();
    } catch {
      // Nothing reaches viewers: end the session at once, so the website does not show an empty player.
      mixer?.dispose();
      publisherRef.current = null;
      sessionRef.current = null;
      setSession(null);
      setPhase(streamRef.current ? 'preview' : 'off');
      setAnnouncement('');
      setError({ text: t('live.errConnect') });
      // failed: the history says "Failed", not "Ended" (the camera never reached Cloudflare).
      await proxyCall({ method: 'POST', path: 'live/stop', body: { sessionId: started.session.id, failed: true }, schema: liveStopSchema }).catch(() => undefined);
      refreshLivePage();
      return false;
    }
    if (mixer) startRecording(mixer, started.session, title);
    setLiveSince(clock());
    setPhase('live');
    refreshLivePage();
    return true;
  }, [message, onWhipState, recordSupport, refreshLivePage, setPhase, startRecording, t]);

  const stopNow = useCallback(async () => {
    const live = sessionRef.current;
    if (!live || phaseRef.current !== 'live') return false;
    setPhase('ending');
    const recording = finishRecording(); // the recording ends with the broadcast
    await publisherRef.current?.stop();
    publisherRef.current = null;
    try {
      await proxyCall({ method: 'POST', path: 'live/stop', body: { sessionId: live.id }, schema: liveStopSchema });
      toast(t('live.stoppedToast'), 'success');
    } catch (e) {
      if (!(isApiError(e) && e.unauthorized)) toast(message(e, t('live.errStop')), 'error');
    }
    sessionRef.current = null;
    setSession(null);
    setWhipState('idle');
    setLiveSince(null);
    setAnnouncement(t('live.stoppedToast'));
    // On the Live page the camera stays on (another broadcast may follow); anywhere else it is turned off.
    if (studios.current === 0) releaseCamera();
    setPhase(streamRef.current ? 'preview' : 'off');
    const item = await recording;
    setRecordingInfo(null);
    if (item) queue.add(item);
    refreshLivePage();
    return true;
  }, [finishRecording, message, queue, refreshLivePage, releaseCamera, setPhase, t, toast]);

  const endBroadcast = useCallback(async () => {
    if (!sessionRef.current || phaseRef.current !== 'live') return false;
    const ok = await confirm({ title: t('live.stopTitle'), message: t('live.stopText'), confirmLabel: t('live.stop'), tone: 'danger' });
    if (!ok) return false;
    return stopNow();
  }, [confirm, stopNow, t]);

  const confirmLeave = useCallback(async () => {
    if (phaseRef.current !== 'live' && phaseRef.current !== 'starting') return true;
    const ok = await confirm({ title: t('live.bar.signOutTitle'), message: t('live.bar.signOutText'), confirmLabel: t('live.bar.signOutConfirm'), tone: 'danger' });
    if (!ok) return false;
    await stopNow();
    return true;
  }, [confirm, stopNow, t]);

  const registerStudio = useCallback(() => {
    studios.current += 1;
    return () => {
      studios.current = Math.max(0, studios.current - 1);
      // Leaving the Live page with the camera on but not broadcasting: the camera goes off (it would stay lit for nothing).
      if (studios.current === 0 && (phaseRef.current === 'preview' || phaseRef.current === 'opening')) {
        if (phaseRef.current === 'preview') releaseCamera();
        setPhase('off');
      }
      // A message about the camera belongs to the visit that caused it.
      if (studios.current === 0 && phaseRef.current === 'off') setError(null);
    };
  }, [releaseCamera, setPhase]);

  const value = useMemo<LiveBroadcastValue>(() => ({
    phase, isLive, active, stream, cameras, microphones, videoId, audioId, hasAudio, muted, mirrored, error, setError,
    session, whipState, liveSince, announcement, recordSupport, recordingInfo, store, queue, uploadView, uploadAnnouncement,
    ensureStore, openCamera, closeCamera, chooseCamera, chooseMicrophone, switchCamera, toggleMute, goLive, endBroadcast,
    confirmLeave, registerStudio, attachPreview,
  }), [
    phase, isLive, active, stream, cameras, microphones, videoId, audioId, hasAudio, muted, mirrored, error, session, whipState,
    liveSince, announcement, recordSupport, recordingInfo, store, queue, uploadView, uploadAnnouncement, ensureStore, openCamera,
    closeCamera, chooseCamera, chooseMicrophone, switchCamera, toggleMute, goLive, endBroadcast, confirmLeave, registerStudio,
    attachPreview,
  ]);

  return (
    <LiveBroadcastContext.Provider value={value}>
      {children}
      {/* Where the camera preview waits for a moment between two pages (it must stay in the page to keep playing). */}
      <div ref={parkingRef} className="live-parking" aria-hidden="true" />
    </LiveBroadcastContext.Provider>
  );
}

/** A place the camera preview is shown in (the studio's big one, the bar's thumbnail). */
export function PreviewSlot({ className, videoClassName, label, testId }: { className: string; videoClassName: string; label: string; testId?: string }) {
  const live = useLiveBroadcast();
  const slotRef = useRef<HTMLDivElement>(null);
  const { attachPreview } = live;
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    return attachPreview(slot, { label, testId, className: videoClassName });
  }, [attachPreview, label, testId, videoClassName]);
  return <div ref={slotRef} className={className} />;
}

/** A clock that ticks every second while `on` (the elapsed time on the badge). */
export function useTicker(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [on]);
  return now;
}
