import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../../next.config';
import { liveStartSchema, liveStateSchema, WHIP_URL } from '@/lib/api';
import { buildCsp, CLOUDFLARE_STREAM } from '@/lib/csp';
import { formatElapsed, listDevices, mediaProblem, mediaSupportProblem, videoConstraints } from '@/lib/media';
import { resolveProxyPath } from '@/lib/proxy-allow';
import { can, navFor, pageNeeds } from '@/lib/roles';
import { checkWhipUrl, sessionUrl, WhipError, WhipPublisher, type WhipState } from '@/lib/whip';
import { proxy } from '@/proxy';

// Live broadcasting in the dashboard (docs/LIVE.md): the WHIP client against a fake RTCPeerConnection and a fake fetch,
// the camera helpers, and the page's own security rules (CSP connect-src, Permissions-Policy, proxy allow-list, role).

const SECRET = 'a'.repeat(64);
const WHIP = `https://customer-abc123.cloudflarestream.com/${SECRET}/webRTC/publish`;
const ANSWER = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n';

// ---- a fake RTCPeerConnection: enough of the API for the client, with a way to change the connection state
class FakePeer extends EventTarget {
  static all: FakePeer[] = [];
  config: RTCConfiguration;
  transceivers: { track: MediaStreamTrack; init: RTCRtpTransceiverInit; sender: { track: MediaStreamTrack | null; replaceTrack: ReturnType<typeof vi.fn>; getParameters: () => RTCRtpSendParameters; setParameters: ReturnType<typeof vi.fn> } }[] = [];
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  iceGatheringState: RTCIceGatheringState = 'new';
  connectionState: RTCPeerConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  closed = false;
  constructor(config: RTCConfiguration) {
    super();
    this.config = config;
    FakePeer.all.push(this);
  }
  addTransceiver(track: MediaStreamTrack, init: RTCRtpTransceiverInit) {
    const sender = { track, replaceTrack: vi.fn(async (t: MediaStreamTrack) => { sender.track = t; }), getParameters: () => ({ encodings: [{}] }) as unknown as RTCRtpSendParameters, setParameters: vi.fn(async () => undefined) };
    this.transceivers.push({ track, init, sender });
    return { sender } as unknown as RTCRtpTransceiver;
  }
  getSenders() { return this.transceivers.map((t) => t.sender) as unknown as RTCRtpSender[]; }
  async createOffer() { return { type: 'offer' as const, sdp: `v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nfake-offer-${FakePeer.all.length}\r\n` }; }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    this.localDescription = d;
    setTimeout(() => { this.iceGatheringState = 'complete'; this.dispatchEvent(new Event('icegatheringstatechange')); }, 1);
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) { this.remoteDescription = d; }
  close() { this.closed = true; this.signalingState = 'closed'; }
  setConnection(state: RTCPeerConnectionState) { this.connectionState = state; this.dispatchEvent(new Event('connectionstatechange')); }
}

const track = (kind: 'audio' | 'video') => ({ kind, id: `${kind}-1`, stop: vi.fn(), enabled: true }) as unknown as MediaStreamTrack;
class FakeStream {
  tracks: MediaStreamTrack[];
  constructor(tracks: MediaStreamTrack[] = [track('video'), track('audio')]) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
}
vi.stubGlobal('MediaStream', FakeStream);

const answer = (status = 201, headers: Record<string, string> = { Location: '/abc/webRTC/publish/session-1' }, body = ANSWER) =>
  new Response(body, { status, headers: { 'Content-Type': 'application/sdp', ...headers } });

function publisher(fetchImpl: ReturnType<typeof vi.fn>, extra: Partial<ConstructorParameters<typeof WhipPublisher>[0]> = {}) {
  const states: WhipState[] = [];
  const pub = new WhipPublisher({
    url: WHIP,
    stream: new FakeStream() as unknown as MediaStream,
    onState: (s) => states.push(s),
    fetchImpl: fetchImpl as unknown as typeof fetch,
    createPeerConnection: (config) => new FakePeer(config) as unknown as RTCPeerConnection,
    iceGatheringTimeoutMs: 200,
    wait: async () => undefined,
    ...extra,
  });
  return { pub, states };
}

afterEach(() => {
  FakePeer.all = [];
});

describe('WHIP client (lib/whip.ts)', () => {
  it('sends the offer as application/sdp to the WHIP address, send-only, and applies the answer', async () => {
    const fetchImpl = vi.fn(async () => answer());
    const { pub, states } = publisher(fetchImpl);
    await pub.start();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(WHIP);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/sdp');
    expect(init.credentials).toBe('omit'); // no cookie of ours ever goes to Cloudflare
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(String(init.body)).toContain('fake-offer');
    const peer = FakePeer.all[0];
    expect(peer.config.iceServers).toEqual([{ urls: 'stun:stun.cloudflare.com:3478' }]);
    expect(peer.config.bundlePolicy).toBe('max-bundle');
    expect(peer.transceivers.map((t) => [t.track.kind, t.init.direction])).toEqual([['video', 'sendonly'], ['audio', 'sendonly']]);
    expect(peer.remoteDescription).toEqual({ type: 'answer', sdp: ANSWER });
    expect(states).toEqual(['connecting']);
    peer.setConnection('connected');
    expect(states.at(-1)).toBe('connected');
  });

  it('stops with a DELETE of the session address (same host only) and closes the connection', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'DELETE' ? new Response(null, { status: 200 }) : answer()));
    const { pub, states } = publisher(fetchImpl);
    await pub.start();
    await pub.stop({ keepalive: true });
    const del = fetchImpl.mock.calls.find((c) => (c[1] as RequestInit).method === 'DELETE') as unknown as [string, RequestInit];
    expect(del[0]).toBe('https://customer-abc123.cloudflarestream.com/abc/webRTC/publish/session-1');
    expect(del[1].keepalive).toBe(true);
    expect(FakePeer.all[0].closed).toBe(true);
    expect(states.at(-1)).toBe('closed');
    await pub.stop(); // a second stop does nothing
    expect(fetchImpl.mock.calls.filter((c) => (c[1] as RequestInit).method === 'DELETE')).toHaveLength(1);
  });

  it('never follows a Location on another host', () => {
    const whip = new URL(WHIP);
    expect(sessionUrl('https://evil.example.com/x', whip)).toBeNull();
    expect(sessionUrl('http://customer-abc123.cloudflarestream.com/x', whip)).toBeNull();
    expect(sessionUrl('//evil.example.com/x', whip)).toBeNull();
    expect(sessionUrl(null, whip)).toBeNull();
    expect(sessionUrl('/x/y', whip)).toBe('https://customer-abc123.cloudflarestream.com/x/y');
  });

  it('refuses an address that is not a Cloudflare Stream WHIP address', () => {
    for (const bad of ['http://customer-a.cloudflarestream.com/x/webRTC/publish', 'https://evil.com/x/webRTC/publish', 'https://customer-a.cloudflarestream.com/x/webRTC/play', 'nope']) {
      expect(() => checkWhipUrl(bad)).toThrow(WhipError);
    }
    expect(WHIP_URL.test(WHIP)).toBe(true);
    expect(WHIP_URL.test('https://customer-a.cloudflarestream.com.evil.com/x/webRTC/publish')).toBe(false);
  });

  it('a refusal, a network failure or a strange answer is an error that never contains the address', async () => {
    const cases: [ReturnType<typeof vi.fn>, WhipError['kind']][] = [
      [vi.fn(async () => answer(403, {}, 'forbidden')), 'http'],
      [vi.fn(async () => answer(409, {}, 'busy')), 'http'],
      [vi.fn(async () => { throw new TypeError('Failed to fetch'); }), 'network'],
      [vi.fn(async () => answer(201, {}, '<html>')), 'sdp'],
    ];
    for (const [fetchImpl, kind] of cases) {
      const { pub, states } = publisher(fetchImpl);
      const error = await pub.start().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(WhipError);
      expect((error as WhipError).kind).toBe(kind);
      expect((error as WhipError).message).not.toContain(SECRET);
      expect(states.at(-1)).toBe('failed');
      expect(FakePeer.all.at(-1)!.closed).toBe(true);
    }
  });

  it('after a failed connection it opens a new WHIP session, a few times, then says failed', async () => {
    const fetchImpl = vi.fn(async () => answer());
    const { pub, states } = publisher(fetchImpl, { maxReconnects: 2 });
    await pub.start();
    FakePeer.all[0].setConnection('failed');
    await vi.waitFor(() => expect(FakePeer.all).toHaveLength(2));
    expect(states).toContain('reconnecting');
    FakePeer.all[1].setConnection('connected');
    expect(states.at(-1)).toBe('connected');

    fetchImpl.mockImplementation(async () => answer(503, {}, 'down'));
    FakePeer.all[1].setConnection('failed');
    await vi.waitFor(() => expect(states.at(-1)).toBe('failed'));
    expect(FakePeer.all.length).toBe(4); // two more tries
  });

  it('switches a camera without a new connection (replaceTrack)', async () => {
    const { pub } = publisher(vi.fn(async () => answer()));
    await pub.start();
    const back = track('video');
    await pub.replaceTrack(back);
    expect(FakePeer.all[0].transceivers[0].sender.replaceTrack).toHaveBeenCalledWith(back);
    expect(FakePeer.all).toHaveLength(1);
  });
});

describe('camera helpers (lib/media.ts)', () => {
  it('names every getUserMedia failure in words the page translates', () => {
    expect(mediaProblem(new DOMException('x', 'NotAllowedError'))).toBe('denied');
    expect(mediaProblem(new DOMException('x', 'SecurityError'))).toBe('denied');
    expect(mediaProblem(new DOMException('x', 'NotFoundError'))).toBe('notFound');
    expect(mediaProblem(new DOMException('x', 'OverconstrainedError'))).toBe('notFound');
    expect(mediaProblem(new DOMException('x', 'NotReadableError'))).toBe('inUse');
    expect(mediaProblem(new Error('x'))).toBe('other');
    expect(mediaProblem(null)).toBe('other');
  });

  it('checks the page before asking: https, browser support, and the Permissions-Policy of this page', () => {
    const win = (over: Record<string, unknown>) => ({
      isSecureContext: true, RTCPeerConnection: function RTCPeerConnection() {}, navigator: { mediaDevices: { getUserMedia: () => undefined } },
      document: {}, ...over,
    }) as unknown as Window & typeof globalThis;
    expect(mediaSupportProblem(undefined)).toBe('unsupported');
    expect(mediaSupportProblem(win({ isSecureContext: false }))).toBe('insecure');
    expect(mediaSupportProblem(win({ navigator: {} }))).toBe('unsupported');
    expect(mediaSupportProblem(win({ document: { permissionsPolicy: { allowsFeature: (f: string) => f !== 'camera' } } }))).toBe('blockedByPolicy');
    expect(mediaSupportProblem(win({ document: { featurePolicy: { allowsFeature: () => true } } }))).toBeNull();
    expect(mediaSupportProblem(win({}))).toBeNull();
  });

  it('lists devices, numbering the ones whose name the browser hides', () => {
    const d = (kind: MediaDeviceKind, deviceId: string, label = '') => ({ kind, deviceId, label, groupId: '' }) as MediaDeviceInfo;
    const list = listDevices([d('videoinput', 'c1', 'Front'), d('videoinput', 'c2'), d('audioinput', 'm1'), d('audiooutput', 'o1'), d('videoinput', '')], (kind, n) => `${kind} ${n}`);
    expect(list.cameras).toEqual([{ id: 'c1', label: 'Front' }, { id: 'c2', label: 'camera 2' }]);
    expect(list.microphones).toEqual([{ id: 'm1', label: 'microphone 1' }]);
  });

  it('asks for 720p30 from the chosen camera, or the front/back one', () => {
    expect(videoConstraints({ facing: 'environment' })).toMatchObject({ facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, frameRate: { max: 30 } });
    expect(videoConstraints({ videoId: 'c2' })).toMatchObject({ deviceId: { exact: 'c2' } });
  });

  it('formats the time on air', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_909_000)).toBe('1:05:09');
    expect(formatElapsed(-5)).toBe('0:00');
  });
});

describe('the Live page\'s security rules', () => {
  it('only /live may connect to Cloudflare Stream (CSP connect-src)', () => {
    expect(buildCsp({ nonce: 'n', live: true })).toContain(`connect-src 'self' https://firebasestorage.googleapis.com ${CLOUDFLARE_STREAM}`);
    expect(buildCsp({ nonce: 'n' })).not.toContain('cloudflarestream');
    const cookie = `nhc_admin=${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.s`;
    const page = (path: string) => proxy(new NextRequest(`http://localhost:3901${path}`, { headers: { host: 'localhost:3901', cookie } })).headers.get('content-security-policy') ?? '';
    expect(page('/live')).toContain('https://*.cloudflarestream.com');
    expect(page('/orders')).not.toContain('cloudflarestream');
    expect(page('/live/x')).not.toContain('cloudflarestream');
    expect(page('/live')).toContain("media-src 'none'"); // the preview uses srcObject, not a media URL
  });

  it('only /live may use the camera and microphone (Permissions-Policy)', async () => {
    const rules = await nextConfig.headers!();
    const policyFor = (source: string) => rules.filter((r) => r.source === source).flatMap((r) => r.headers).find((h) => h.key === 'Permissions-Policy')?.value ?? '';
    expect(policyFor('/:path*')).toContain('camera=()');
    expect(policyFor('/:path*')).toContain('microphone=()');
    expect(policyFor('/live')).toContain('camera=(self)');
    expect(policyFor('/live')).toContain('microphone=(self)');
    expect(policyFor('/live')).toContain('geolocation=()'); // everything else stays off
    // the /live rule comes after the general one (the later one wins)
    expect(rules.findIndex((r) => r.source === '/live')).toBeGreaterThan(rules.findIndex((r) => r.source === '/:path*'));
  });

  it('the browser may call exactly the three live routes through the proxy', () => {
    expect(resolveProxyPath(['live'], 'GET')).toBe('/admin/live');
    expect(resolveProxyPath(['live', 'start'], 'POST')).toBe('/admin/live/start');
    expect(resolveProxyPath(['live', 'stop'], 'POST')).toBe('/admin/live/stop');
    expect(resolveProxyPath(['live'], 'POST')).toBeNull();
    expect(resolveProxyPath(['live', 'start'], 'GET')).toBeNull();
    expect(resolveProxyPath(['live', 'other'], 'POST')).toBeNull();
    expect(resolveProxyPath(['live', 'stop'], 'DELETE')).toBeNull();
  });

  it('editors and owners broadcast; viewers do not even see the entry', () => {
    expect(can('owner', 'broadcast')).toBe(true);
    expect(can('editor', 'broadcast')).toBe(true);
    expect(can('viewer', 'broadcast')).toBe(false);
    expect(navFor('editor').map((n) => n.id)).toContain('live');
    expect(navFor('viewer').map((n) => n.id)).not.toContain('live');
    expect(pageNeeds('/live')).toBe('broadcast');
  });

  it('the answers are parsed strictly: a start without a Cloudflare WHIP address is refused', () => {
    const session = { _id: 'a'.repeat(24), title: 'T', status: 'live', inputUid: 'b'.repeat(32), whepUrl: 'https://customer-abc123.cloudflarestream.com/x/webRTC/play', startedAt: '2026-10-06T10:00:00.000Z', startedBy: { id: null, name: 'x' } };
    expect(liveStartSchema.safeParse({ session, whipUrl: WHIP }).success).toBe(true);
    expect(liveStartSchema.safeParse({ session, whipUrl: 'https://evil.example.com/x/webRTC/publish' }).success).toBe(false);
    expect(liveStateSchema.safeParse({ configured: false, maxMinutes: 360, current: null, history: [] }).success).toBe(true);
    expect(liveStateSchema.safeParse({ configured: true, maxMinutes: 360, current: { ...session, status: 'paused' }, history: [] }).success).toBe(false);
  });
});
