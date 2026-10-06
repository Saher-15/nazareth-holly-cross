// A small WHIP client (WebRTC-HTTP Ingestion Protocol, RFC 9725): publishes the camera and microphone of this browser to
// Cloudflare Stream (docs/LIVE.md). No dependency.
//
//   1. one RTCPeerConnection, a send-only transceiver per track
//   2. create the SDP offer, wait until the ICE candidates are gathered (or a short timeout)
//   3. POST the offer (Content-Type: application/sdp) to the WHIP address; 201 + the SDP answer + Location (the session)
//   4. apply the answer; the connection state says when media flows
//   5. stop: DELETE the session address, close the connection
//
// The WHIP address holds the broadcast secret of the input: it is never logged, never put in an error message, never
// stored (it lives in this object only). The session address from `Location` is used only when it is on the same
// https host as the WHIP address.

export type WhipState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'closed';

export class WhipError extends Error {
  readonly kind: 'http' | 'network' | 'sdp' | 'closed';
  readonly status: number | null;
  constructor(kind: WhipError['kind'], message: string, status: number | null = null) {
    super(message);
    this.name = 'WhipError';
    this.kind = kind;
    this.status = status;
  }
}

export type WhipOptions = {
  /** Cloudflare's WHIP address (https://customer-<code>.cloudflarestream.com/<secret>/webRTC/publish). */
  url: string;
  stream: MediaStream;
  onState?: (state: WhipState) => void;
  /** How long to wait for ICE gathering before sending what was gathered (ms). */
  iceGatheringTimeoutMs?: number;
  /** Upper bound of the video bitrate (bits per second): keeps a phone's upload steady. */
  maxVideoBitrate?: number;
  /** Automatic reconnections after the connection failed (each one is a new WHIP session). */
  maxReconnects?: number;
  // Injectable for tests.
  fetchImpl?: typeof fetch;
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection;
  /** setTimeout for reconnect back-off (tests pass a fast one). */
  wait?: (ms: number) => Promise<void>;
};

export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The WHIP address, checked: https and a Cloudflare Stream customer host. Throws without echoing the address. */
export function checkWhipUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WhipError('http', 'The publish address is not valid.');
  }
  if (url.protocol !== 'https:' || !/^customer-[a-z0-9]{1,64}\.cloudflarestream\.com$/.test(url.hostname) || !url.pathname.endsWith('/webRTC/publish')) {
    throw new WhipError('http', 'The publish address is not a Cloudflare Stream address.');
  }
  return url;
}

/** The session address of a WHIP answer: Location, resolved against the WHIP address, only on the same https host. */
export function sessionUrl(location: string | null, whip: URL): string | null {
  if (!location) return null;
  try {
    const url = new URL(location, whip);
    return url.protocol === 'https:' && url.host === whip.host ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Resolves once ICE gathering is complete, or after `timeoutMs` (whatever was gathered by then is sent). */
export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

export class WhipPublisher {
  private readonly whip: URL;
  private readonly options: Required<Pick<WhipOptions, 'iceGatheringTimeoutMs' | 'maxVideoBitrate' | 'maxReconnects'>> & WhipOptions;
  private pc: RTCPeerConnection | null = null;
  private resource: string | null = null;
  private stream: MediaStream;
  private stopped = false;
  private reconnects = 0;
  state: WhipState = 'idle';

  constructor(options: WhipOptions) {
    this.whip = checkWhipUrl(options.url);
    this.stream = options.stream;
    this.options = { iceGatheringTimeoutMs: 2500, maxVideoBitrate: 2_500_000, maxReconnects: 3, ...options };
  }

  private setState(state: WhipState) {
    if (this.state === state) return;
    this.state = state;
    this.options.onState?.(state);
  }

  private get fetch(): typeof fetch {
    return this.options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /** Connects. Throws a WhipError when Cloudflare refuses or cannot be reached (nothing is left open then). */
  async start(): Promise<void> {
    if (this.stopped) throw new WhipError('closed', 'The broadcast was stopped.');
    this.setState('connecting');
    try {
      await this.connect();
    } catch (error) {
      this.closePeer();
      this.setState('failed');
      throw error;
    }
  }

  private async connect(): Promise<void> {
    const create = this.options.createPeerConnection ?? ((config: RTCConfiguration) => new RTCPeerConnection(config));
    const pc = create({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' });
    this.pc = pc;
    for (const track of this.stream.getTracks()) {
      const transceiver = pc.addTransceiver(track, { direction: 'sendonly', streams: [this.stream] });
      if (track.kind === 'video') void this.limitBitrate(transceiver.sender);
    }
    pc.addEventListener('connectionstatechange', () => this.onConnectionState(pc));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc, this.options.iceGatheringTimeoutMs);
    const sdp = pc.localDescription?.sdp;
    if (!sdp) throw new WhipError('sdp', 'The browser could not prepare the connection.');

    let res: Response;
    try {
      res = await this.fetch(this.whip.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
        body: sdp,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
      });
    } catch {
      throw new WhipError('network', 'Cloudflare Stream cannot be reached.');
    }
    if (res.status !== 201 && res.status !== 200) throw new WhipError('http', `Cloudflare Stream refused the connection (${res.status}).`, res.status);
    const answer = await res.text();
    if (!answer.trim().startsWith('v=')) throw new WhipError('sdp', 'Cloudflare Stream sent an unexpected answer.');
    this.resource = sessionUrl(res.headers.get('location'), this.whip);
    if (this.stopped || pc.signalingState === 'closed') throw new WhipError('closed', 'The broadcast was stopped.');
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
  }

  private async limitBitrate(sender: RTCRtpSender) {
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = this.options.maxVideoBitrate;
      await sender.setParameters(params);
    } catch {
      // Some browsers only accept parameters after negotiation; the default bitrate is fine then.
    }
  }

  private onConnectionState(pc: RTCPeerConnection) {
    if (pc !== this.pc || this.stopped) return;
    const state = pc.connectionState;
    if (state === 'connected') {
      this.reconnects = 0;
      this.setState('connected');
    } else if (state === 'disconnected') {
      this.setState('reconnecting'); // often recovers by itself (a network hiccup)
    } else if (state === 'failed') {
      void this.reconnect();
    }
  }

  /** After a failed connection: a new WHIP session, with a growing pause, a few times; then 'failed'. */
  private async reconnect() {
    const old = this.pc;
    const oldResource = this.resource;
    this.pc = null;
    this.resource = null;
    old?.close();
    if (oldResource) void this.deleteResource(oldResource);
    while (!this.stopped && this.reconnects < this.options.maxReconnects) {
      this.reconnects += 1;
      this.setState('reconnecting');
      await (this.options.wait ?? sleep)(1000 * 2 ** (this.reconnects - 1));
      if (this.stopped) return;
      try {
        await this.connect();
        return; // the connection state will say 'connected'
      } catch {
        this.closePeer();
      }
    }
    if (!this.stopped) this.setState('failed');
  }

  /** Swaps a camera or microphone without a new connection (switching front/back camera while live). */
  async replaceTrack(track: MediaStreamTrack): Promise<void> {
    const tracks = this.stream.getTracks().filter((t) => t.kind !== track.kind);
    this.stream = new MediaStream([...tracks, track]);
    const sender = this.pc?.getSenders().find((s) => s.track?.kind === track.kind || (!s.track && track.kind === 'video'));
    if (sender) await sender.replaceTrack(track);
  }

  private deleteResource(url: string, keepalive = false): Promise<void> {
    return this.fetch(url, { method: 'DELETE', keepalive, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' })
      .then(() => undefined)
      .catch(() => undefined);
  }

  private closePeer() {
    try {
      this.pc?.close();
    } catch {
      // already closed
    }
    this.pc = null;
  }

  /** Ends the WHIP session (DELETE) and closes the connection. `keepalive` for a page that is being closed. */
  async stop({ keepalive = false }: { keepalive?: boolean } = {}): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    const resource = this.resource;
    this.resource = null;
    this.closePeer();
    this.setState('closed');
    if (resource) await this.deleteResource(resource, keepalive);
  }
}
