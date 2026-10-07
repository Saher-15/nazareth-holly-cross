'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError, liveStartSchema, liveStopSchema, type LiveSession, type ScheduledBroadcast } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import {
  audioConstraints, formatElapsed, listDevices, mediaProblem, mediaSupportProblem, stopStream, videoConstraints,
  type Device, type Facing, type MediaProblem,
} from '@/lib/media';
import { BroadcastRecorder, pickMimeType, prefersMp4, RecorderMixer, recordingSupported } from '@/lib/recorder';
import {
  askPersistentStorage, heldRecordingIds, holdRecordingLock, openRecordingStore, type LocalRecording, type RecordingStore,
} from '@/lib/recording-store';
import type { Role } from '@/lib/roles';
import { matchScheduled, NAZARETH_TIME_ZONE } from '@/lib/schedule';
import { holdSession } from '@/lib/session-hold';
import { WhipPublisher, type WhipState } from '@/lib/whip';
import { megabytes, UnfinishedRecordings, UploadStatus, useUploadQueue, type UploadItem } from './RecordingUploads';

// The studio of the Live page (docs/LIVE.md):
//   1. turn on the camera and microphone (the browser asks), see the preview, choose devices, front/back on a phone
//   2. a title, "Go live": the API creates the Cloudflare input and returns the WHIP address (only to this page), the
//      browser publishes to it (lib/whip.ts); the website's /live page shows the player within seconds
//   3. LIVE badge and elapsed time, mute, switch camera while live, "End broadcast"
// Leaving or closing the page ends the broadcast (a keepalive "stop" when the page is hidden for good, and the server
// ends a forgotten one after its maximum duration anyway). The WHIP address is kept in memory only.
//
// Recording (on by default, "Record this broadcast"): the page records what it publishes (lib/recorder.ts: a canvas +
// WebAudio mixer, so switching the camera or the microphone never stops it), keeps every piece in memory and in
// IndexedDB (lib/recording-store.ts), and after "End broadcast" uploads the file straight to Cloudflare
// (RecordingUploads.tsx, lib/tus.ts). A recording left behind by a closed tab is offered again on the next visit.
// "Go live" can name the scheduled broadcast it fulfils; the closest one within two hours is suggested.

type Phase = 'off' | 'opening' | 'preview' | 'starting' | 'live' | 'ending';

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

type RecordSupport = 'unknown' | 'yes' | 'no';

type WakeLockSentinelLike = { release(): Promise<void> };

const TITLE_MAX = 120;

/** The clock and a fresh id, for event handlers (never called while rendering). */
const clock = () => Date.now();
const newLocalId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${clock()}-${Math.random().toString(16).slice(2)}`);

/** "stop" that survives the page being closed: keepalive, same-origin, through the BFF like every other call. */
function sendStopBeacon(sessionId: string) {
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

export function LiveStudio({ configured, current, maxMinutes, me, scheduled = [], timeZone = NAZARETH_TIME_ZONE }: Props) {
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();
  const router = useRouter();
  const uid = useId();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const publisherRef = useRef<WhipPublisher | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const mixerRef = useRef<RecorderMixer | null>(null);
  const recorderRef = useRef<BroadcastRecorder | null>(null);
  const lockRef = useRef<(() => void) | null>(null);
  const storeRef = useRef<RecordingStore | null>(null);
  const scheduleTouched = useRef(false);

  const [phase, setPhase] = useState<Phase>('off');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<Device[]>([]);
  const [microphones, setMicrophones] = useState<Device[]>([]);
  const [videoId, setVideoId] = useState('');
  const [audioId, setAudioId] = useState('');
  const [facing, setFacing] = useState<Facing>('user');
  const [muted, setMuted] = useState(false);
  const [hasAudio, setHasAudio] = useState(true);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; reload?: boolean } | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [whipState, setWhipState] = useState<WhipState>('idle');
  const [liveSince, setLiveSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState('');
  const [record, setRecord] = useState(true);
  const [recordSupport, setRecordSupport] = useState<RecordSupport>('unknown');
  const [recordMime, setRecordMime] = useState('');
  const [recordingInfo, setRecordingInfo] = useState<{ size: number; persisted: boolean } | null>(null);
  const [scheduleId, setScheduleId] = useState('');
  const [store, setStore] = useState<RecordingStore | null>(null);
  const [unfinished, setUnfinished] = useState<LocalRecording[]>([]);
  const { queue, view: uploadView, announcement: uploadAnnouncement } = useUploadQueue(store);
  const waiting = scheduled.filter((s) => s.status === 'scheduled');

  const isLive = phase === 'live' || phase === 'ending';
  // The broadcast that is live on the server and is NOT this page's (another admin, or this admin before a reload).
  const other = current && current.id !== session?.id ? current : null;

  // While on air the idle sign-out must not leave the page (that would end the broadcast): lib/session-hold.ts.
  const holding = isLive || phase === 'starting';
  useEffect(() => (holding ? holdSession() : undefined), [holding]);

  // ---- the preview follows the stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined); // muted + playsInline: allowed without a gesture
  }, [stream]);

  const mirrored = (() => {
    const settings = stream?.getVideoTracks()[0]?.getSettings?.();
    return settings?.facingMode !== 'environment';
  })();

  const refreshDevices = useCallback(async () => {
    try {
      const list = listDevices(await navigator.mediaDevices.enumerateDevices(), (kind, n) => t(kind === 'camera' ? 'live.cameraN' : 'live.microphoneN', { n }));
      setCameras(list.cameras);
      setMicrophones(list.microphones);
    } catch {
      // the lists stay as they were
    }
  }, [t]);

  // ---- everything that must end with the page
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

  useEffect(() => {
    return () => {
      // Unmounting (leaving the page inside the dashboard): end the broadcast and turn the camera off. A recording is
      // still uploaded (the upload carries on while the admin is on another page of the dashboard).
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

  // ---- this browser's copy of recordings: open it, and offer what an earlier visit left behind
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const opened = await openRecordingStore();
      if (cancelled) return;
      storeRef.current = opened;
      setStore(opened);
      if (!opened) return;
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
  }, [me.id, me.role]);

  useEffect(() => {
    if (!isLive) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
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
      window.clearInterval(tick);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseWakeLock();
    };
  }, [isLive, releaseWakeLock]);

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

  function showMediaProblem(problem: MediaProblem) {
    setError({ text: t(`live.err.${problem}`), reload: problem === 'blockedByPolicy' });
  }

  // ---- camera
  async function openCamera() {
    if (phase !== 'off') return;
    const problem = mediaSupportProblem(window);
    if (problem) return showMediaProblem(problem);
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
        return showMediaProblem(mediaProblem(first));
      }
      try {
        media = await navigator.mediaDevices.getUserMedia({ video: videoConstraints({ facing }) });
        audio = false;
      } catch (second) {
        setPhase('off');
        return showMediaProblem(mediaProblem(second));
      }
    }
    streamRef.current = media;
    setStream(media);
    setHasAudio(audio);
    setMuted(false);
    setVideoId(media.getVideoTracks()[0]?.getSettings?.().deviceId ?? '');
    setAudioId(media.getAudioTracks()[0]?.getSettings?.().deviceId ?? '');
    setPhase('preview');
    // What this browser can record, and the scheduled broadcast this one most likely fulfils (within two hours).
    const mime = recordingSupported(window) ? pickMimeType(window.MediaRecorder.isTypeSupported?.bind(window.MediaRecorder), prefersMp4(navigator.userAgent)) : '';
    setRecordMime(mime);
    setRecordSupport(mime ? 'yes' : 'no');
    if (!scheduleTouched.current) {
      const match = matchScheduled(waiting, clock());
      if (match) {
        setScheduleId(match.id);
        setTitle((typed) => (typed.trim() ? typed : match.title));
      }
    }
    await refreshDevices();
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

  function closeCamera() {
    if (isLive) return;
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setPhase('off');
  }

  /** A new camera or microphone: the old one is released first (a phone cannot open two cameras at once). */
  async function replaceTrack(kind: 'video' | 'audio', choice: { videoId?: string; audioId?: string; facing?: Facing }) {
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
    if (kind === 'audio') track.enabled = !muted;
    const next = new MediaStream([...currentStream.getTracks().filter((tr) => tr.kind !== kind), track]);
    streamRef.current = next;
    setStream(next);
    setError(null);
    mixerRef.current?.setSource(next); // the recording follows the new microphone (and the preview's new camera)
    await publisherRef.current?.replaceTrack(track);
    return true;
  }

  async function chooseCamera(id: string) {
    setVideoId(id);
    await replaceTrack('video', { videoId: id });
  }

  async function chooseMicrophone(id: string) {
    setAudioId(id);
    await replaceTrack('audio', { audioId: id });
  }

  async function switchCamera() {
    const next: Facing = facing === 'user' ? 'environment' : 'user';
    if (await replaceTrack('video', { facing: next })) {
      setFacing(next);
      setVideoId(streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId ?? '');
    } else {
      await replaceTrack('video', { facing }); // back to the camera that worked
    }
  }

  function toggleMute() {
    const next = !muted;
    for (const track of streamRef.current?.getAudioTracks() ?? []) track.enabled = !next;
    mixerRef.current?.setMuted(next); // silence is recorded while muted
    setMuted(next);
  }

  // ---- going live and ending
  const message = (e: unknown, fallback: string) => (isApiError(e) && e.status < 500 && e.status !== 429 ? e.message : fallback);

  async function goLive(event: FormEvent) {
    event.preventDefault();
    if (phase !== 'preview' || !streamRef.current) return;
    const text = title.trim();
    if (!text) {
      setTitleError(t('live.errTitle'));
      return;
    }
    setTitleError(null);
    setError(null);
    // The recorder's mixer is made inside this click: browsers start WebAudio only after a gesture.
    let mixer: RecorderMixer | null = null;
    if (record && recordSupport === 'yes' && videoRef.current) {
      try {
        mixer = new RecorderMixer(videoRef.current, streamRef.current, { muted });
      } catch {
        mixer = null; // the broadcast goes ahead without a recording
      }
    }
    const planned = waiting.some((s) => s.id === scheduleId) ? scheduleId : '';
    setPhase('starting');
    setAnnouncement(t('live.connecting'));

    let started;
    try {
      started = await proxyCall({ method: 'POST', path: 'live/start', body: { title: text, ...(planned ? { scheduleId: planned } : {}) }, schema: liveStartSchema });
    } catch (e) {
      mixer?.dispose();
      setPhase('preview');
      setAnnouncement('');
      if (isApiError(e) && e.unauthorized) return;
      // 404/409 about the scheduled broadcast (a busy 409 names the broadcast that is live: `current`).
      const busy = isApiError(e) && e.status === 409 && Boolean((e.body as { current?: unknown } | undefined)?.current);
      if (isApiError(e) && e.status === 404 && planned) setError({ text: t('live.errScheduleGone') });
      else if (isApiError(e) && e.status === 409 && planned && !busy) setError({ text: t('live.errScheduleState') });
      else if (isApiError(e) && e.status === 409) setError({ text: t('live.busy') });
      else if (isApiError(e) && e.status === 503) setError({ text: t('live.notConfiguredTitle') });
      else setError({ text: message(e, t('live.errStart')) });
      router.refresh();
      return;
    }

    sessionRef.current = started.session;
    setSession(started.session);
    const publisher = new WhipPublisher({ url: started.whipUrl, stream: streamRef.current, onState: onWhipState });
    publisherRef.current = publisher;
    try {
      await publisher.start();
    } catch {
      // Nothing reaches viewers: end the session at once, so the website does not show an empty player.
      mixer?.dispose();
      publisherRef.current = null;
      sessionRef.current = null;
      setSession(null);
      setPhase('preview');
      setAnnouncement('');
      setError({ text: t('live.errConnect') });
      await proxyCall({ method: 'POST', path: 'live/stop', body: { sessionId: started.session.id }, schema: liveStopSchema }).catch(() => undefined);
      router.refresh();
      return;
    }
    if (mixer) startRecording(mixer, started.session, text);
    setScheduleId('');
    scheduleTouched.current = false;
    setLiveSince(clock());
    setNow(clock());
    setPhase('live');
    router.refresh();
  }

  /** The broadcast is on the air: record what it publishes, a piece every few seconds, to memory and IndexedDB. */
  function startRecording(mixer: RecorderMixer, live: LiveSession, text: string) {
    const localId = newLocalId();
    const recorder = new BroadcastRecorder({
      stream: mixer.stream,
      mimeType: recordMime,
      meta: { localId, sessionId: live.id, userId: me.id, title: text },
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
  }

  async function endBroadcast() {
    const live = sessionRef.current;
    if (!live || phase !== 'live') return;
    const ok = await confirm({ title: t('live.stopTitle'), message: t('live.stopText'), confirmLabel: t('live.stop'), tone: 'danger' });
    if (!ok) return;
    setPhase('ending');
    const recording = finishRecording(); // the recording ends with the broadcast
    await publisherRef.current?.stop();
    publisherRef.current = null;
    try {
      await proxyCall({ method: 'POST', path: 'live/stop', body: { sessionId: live.id }, schema: liveStopSchema });
      toast(t('live.stoppedToast'), 'success');
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      toast(message(e, t('live.errStop')), 'error');
    }
    sessionRef.current = null;
    setSession(null);
    setWhipState('idle');
    setLiveSince(null);
    setAnnouncement(t('live.stoppedToast'));
    setPhase(streamRef.current ? 'preview' : 'off');
    const item = await recording;
    setRecordingInfo(null);
    if (item) queue.add(item);
    router.refresh();
  }

  // ---- recordings left behind by an earlier visit
  async function uploadUnfinished(meta: LocalRecording) {
    const opened = storeRef.current;
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
    await storeRef.current?.remove(meta.localId).catch(() => undefined);
    setUnfinished((list) => list.filter((r) => r.localId !== meta.localId));
    toast(t('live.upload.discarded'), 'success');
  }

  async function discardUpload() {
    const ok = await confirm({ title: t('live.upload.discardTitle', { title: uploadView.title }), message: t('live.upload.discardText'), confirmLabel: t('live.upload.discard'), tone: 'danger' });
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

  const elapsed = liveSince ? formatElapsed(now - liveSince) : '';
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
            <video
              ref={videoRef}
              className={`studio__video${mirrored ? ' studio__video--mirror' : ''}`}
              muted
              playsInline
              autoPlay
              aria-label={t('live.previewLabel')}
              data-testid="live-preview"
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
                      <select id={`${uid}-camera`} className="select" value={videoId} onChange={(e) => void chooseCamera(e.target.value)} data-testid="live-camera">
                        {cameras.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                      </select>
                    </div>
                  ) : null}
                  {hasAudio && microphones.length > 0 ? (
                    <div className="field">
                      <label htmlFor={`${uid}-mic`}>{t('live.microphone')}</label>
                      <select id={`${uid}-mic`} className="select" value={audioId} onChange={(e) => void chooseMicrophone(e.target.value)} data-testid="live-microphone">
                        {microphones.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                      </select>
                    </div>
                  ) : null}
                </div>
                {!hasAudio ? <p className="hint">{t('live.noMicrophone')}</p> : null}

                <div className="studio__buttons">
                  {cameras.length > 1 ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void switchCamera()} data-testid="live-switch">
                      <Icon name="switchCamera" size={16} />
                      <span>{t('live.switchCamera')}</span>
                    </button>
                  ) : null}
                  {hasAudio ? (
                    <button type="button" className="btn btn--ghost btn--sm" aria-pressed={muted} onClick={toggleMute} data-testid="live-mute">
                      <Icon name={muted ? 'micOff' : 'mic'} size={16} />
                      <span>{muted ? t('live.unmute') : t('live.mute')}</span>
                    </button>
                  ) : null}
                  {!isLive && phase !== 'starting' ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={closeCamera} data-testid="live-camera-off">
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
                      <button type="button" className="btn btn--danger" onClick={() => void endBroadcast()} disabled={phase === 'ending'} aria-busy={phase === 'ending' || undefined} data-testid="live-stop">
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
            <p className="visually-hidden" role="status" aria-live="polite" data-testid="live-status">{announcement}</p>
            <UploadStatus view={uploadView} announcement={uploadAnnouncement} onRetry={() => queue.retry()} onDiscard={() => void discardUpload()} />
            <p className="hint">{t('live.costHint')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
