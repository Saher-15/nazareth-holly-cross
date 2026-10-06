// Camera and microphone for the Live page (docs/LIVE.md): constraints, the device lists and what a failure means in
// words a person can act on. Browser-only (getUserMedia exists only on https or localhost).

export type Facing = 'user' | 'environment';

export type MediaChoice = { videoId?: string; audioId?: string; facing?: Facing };

/** 720p at up to 30 frames: enough for a phone held in a church, light on a mobile upload. */
export function videoConstraints({ videoId, facing }: MediaChoice): MediaTrackConstraints {
  return {
    ...(videoId ? { deviceId: { exact: videoId } } : { facingMode: { ideal: facing ?? 'user' } }),
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  };
}

export function audioConstraints({ audioId }: MediaChoice): MediaTrackConstraints {
  return { ...(audioId ? { deviceId: { exact: audioId } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true };
}

export type MediaProblem = 'insecure' | 'unsupported' | 'denied' | 'notFound' | 'inUse' | 'blockedByPolicy' | 'other';

/** What went wrong with getUserMedia, in one word the page translates (live.err.<problem>). */
export function mediaProblem(error: unknown): MediaProblem {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'notFound';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'inUse';
  return 'other';
}

/** Checks done before asking: a page on http, an old browser, or this page's Permissions-Policy. */
export function mediaSupportProblem(win: (Window & typeof globalThis) | undefined): MediaProblem | null {
  if (!win) return 'unsupported';
  if (!win.isSecureContext) return 'insecure';
  if (!win.navigator.mediaDevices?.getUserMedia || typeof win.RTCPeerConnection !== 'function') return 'unsupported';
  // Chromium tells whether the page's Permissions-Policy allows the camera (it is decided when the page LOADS: a page
  // reached by client navigation keeps the policy of the first page). Other browsers have no such API.
  const policy = (win.document as Document & { permissionsPolicy?: { allowsFeature(f: string): boolean }; featurePolicy?: { allowsFeature(f: string): boolean } });
  const checker = policy.permissionsPolicy ?? policy.featurePolicy;
  if (checker && (!checker.allowsFeature('camera') || !checker.allowsFeature('microphone'))) return 'blockedByPolicy';
  return null;
}

export type Device = { id: string; label: string };

/** The cameras and microphones, with a numbered name when the browser hides the label (before permission). */
export function listDevices(devices: MediaDeviceInfo[], fallback: (kind: 'camera' | 'microphone', n: number) => string) {
  const of = (kind: MediaDeviceKind, name: 'camera' | 'microphone'): Device[] =>
    devices
      .filter((d) => d.kind === kind && d.deviceId)
      .map((d, i) => ({ id: d.deviceId, label: d.label || fallback(name, i + 1) }));
  return { cameras: of('videoinput', 'camera'), microphones: of('audioinput', 'microphone') };
}

/** Stops every track of a stream (the camera light goes off). */
export function stopStream(stream: MediaStream | null | undefined) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

/** "1:05:09" / "4:07": the time since a start, for the LIVE badge. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
