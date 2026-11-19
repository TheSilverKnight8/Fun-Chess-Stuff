import Peer, { type DataConnection, type PeerOptions } from 'peerjs';

// Rooms, as in Stickman Arena: the host's browser registers a name made from
// the room code with the free PeerJS signaling server; the other player
// connects to that name. After that, game messages go directly between the two
// browsers over WebRTC. No accounts, no database, nothing stored.
//
// Added for chess: a seat token. The host gives the guest a token when they
// join; a guest who loses connection can come back into the same seat with it
// (the reconnect grace period), and nobody else can take that seat meanwhile.

/** Letters and digits that cannot be mistaken for each other: no 0/O, no 1/I. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

/** No message (game or heartbeat) for this long means the other player's connection is lost. */
const SILENCE_LIMIT_MS = 6000;
const HEARTBEAT_MS = 1000;
const CONNECT_TIMEOUT_MS = 15000;

export function makeCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function makeToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cleans up a typed code. Returns null if it cannot be a room code. */
export function normalizeCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, '');
  if (c.length !== CODE_LENGTH) return null;
  for (const ch of c) if (!CODE_ALPHABET.includes(ch)) return null;
  return c;
}

const peerName = (code: string) => `fun-chess-stuff-${code}`;

function peerOptions(): PeerOptions {
  // For testing on one computer: a local PeerJS server (npm run peer) set through
  // VITE_PEER_HOST / VITE_PEER_PORT. The live app uses the free PeerJS cloud server.
  const host = import.meta.env.VITE_PEER_HOST as string | undefined;
  const opts: PeerOptions = { debug: 0 };
  if (host) {
    opts.host = host;
    opts.port = Number(import.meta.env.VITE_PEER_PORT ?? 9000);
    opts.path = '/';
    opts.secure = false;
  }
  if (import.meta.env.VITE_PEER_NO_ICE === '1') opts.config = { iceServers: [] };
  return opts;
}

export type RoomMessage = { t: string; [key: string]: unknown };

/** The host's answer to someone knocking: a new player, the away player coming back, or no room for them. */
export type Admission = 'new' | 'rejoin' | 'full';

export interface RoomHandlers {
  /** Host only: decides whether a player with this token (or none) may come in. */
  admit?(token: string | null): Admission;
  /** Host only: a player came in. `rejoin` is true when they came back into their seat. */
  onJoin?(peerId: string, rejoin: boolean): void;
  /** The other side left on purpose ('left') or stopped answering ('lost'). */
  onLeave?(peerId: string, reason: 'left' | 'lost'): void;
  onMessage?(peerId: string, msg: RoomMessage): void;
}

/**
 * Why joining failed: this device could not reach the signaling server
 * ('offline'), the server has no room with that code ('gone'), the room did not
 * answer ('silent'), or the room turned us away ('full').
 */
export type RoomErrorKind = 'offline' | 'gone' | 'silent' | 'full';

export class RoomError extends Error {
  constructor(
    message: string,
    readonly kind: RoomErrorKind = 'offline',
  ) {
    super(message);
  }
}

interface Link {
  conn: DataConnection;
  lastHeard: number;
}

export class Room {
  readonly links = new Map<string, Link>();
  private beat: number | undefined;
  private closed = false;
  /** Host: the token of the seat (one guest). */
  private seatToken: string | null = null;

  private constructor(
    readonly role: 'host' | 'guest',
    readonly code: string,
    private readonly peer: Peer,
    private readonly handlers: RoomHandlers,
    /** Guest: the seat token the host gave. */
    readonly token: string | null,
  ) {
    this.beat = window.setInterval(() => this.heartbeat(), HEARTBEAT_MS);
  }

  /** Creates a room with a new code. Tries a few codes in case one is taken. */
  static async host(handlers: RoomHandlers): Promise<Room> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      const peer = new Peer(peerName(code), peerOptions());
      try {
        await opened(peer);
      } catch (e) {
        peer.destroy();
        lastError = e;
        if ((e as { type?: string }).type === 'unavailable-id') continue;
        throw new RoomError(signalingMessage(e));
      }
      const room = new Room('host', code, peer, handlers, null);
      peer.on('connection', (conn) => room.knock(conn));
      // The game connection does not need the signaling server, but a player
      // coming back does. Keep trying to get back to it while the room is open.
      peer.on('disconnected', () => room.keepSignaling());
      return room;
    }
    throw new RoomError(signalingMessage(lastError));
  }

  /** Joins the room with this code; with a token, comes back into an earlier seat. */
  static async join(code: string, token: string | null, handlers: RoomHandlers, timeoutMs = CONNECT_TIMEOUT_MS): Promise<Room> {
    const peer = new Peer(peerOptions());
    try {
      await opened(peer, timeoutMs);
    } catch (e) {
      peer.destroy();
      throw new RoomError(signalingMessage(e));
    }
    const hostId = peerName(code);
    const conn = peer.connect(hostId, { reliable: true, serialization: 'json' });
    let seat: string;
    try {
      seat = await new Promise<string>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new RoomError('The room did not answer. Check the code, or try again.', 'silent')), timeoutMs);
        const fail = (e: unknown) => {
          window.clearTimeout(timer);
          const type = (e as { type?: string }).type;
          reject(type === 'peer-unavailable' ? new RoomError(`There is no room with the code ${code}.`, 'gone') : new RoomError(signalingMessage(e)));
        };
        peer.once('error', fail);
        conn.once('error', fail);
        conn.once('open', () => conn.send({ t: 'hello', token }));
        // The host answers with "welcome" (and the seat token) or "full".
        conn.on('data', (d) => {
          const msg = d as RoomMessage;
          if (msg?.t === 'welcome' && typeof msg.token === 'string') {
            window.clearTimeout(timer);
            resolve(msg.token);
          } else if (msg?.t === 'full') {
            window.clearTimeout(timer);
            reject(new RoomError(token ? 'Your seat in that room is gone.' : 'That room already has its players.', 'full'));
          }
        });
      });
    } catch (e) {
      peer.destroy();
      throw e;
    }
    conn.removeAllListeners('data');
    const room = new Room('guest', code, peer, handlers, seat);
    room.attach(hostId, conn);
    return room;
  }

  /** Host: someone connected. They say hello with their token (if any) first. */
  private knock(conn: DataConnection) {
    const timer = window.setTimeout(() => conn.close(), CONNECT_TIMEOUT_MS);
    conn.once('data', (d) => {
      window.clearTimeout(timer);
      const msg = d as RoomMessage;
      if (this.closed || msg?.t !== 'hello') return conn.close();
      const token = typeof msg.token === 'string' ? msg.token : null;
      const verdict = this.handlers.admit?.(token) ?? 'full';
      const rejoin = verdict === 'rejoin' && token !== null && token === this.seatToken;
      if (verdict === 'full' || (verdict === 'rejoin' && !rejoin) || (verdict === 'new' && this.links.size > 0)) {
        conn.send({ t: 'full' });
        window.setTimeout(() => conn.close(), 500);
        return;
      }
      // Coming back: the old connection may not have been noticed as dead yet.
      for (const id of [...this.links.keys()]) this.forget(id);
      if (!rejoin) this.seatToken = makeToken();
      this.attach(conn.peer, conn);
      conn.send({ t: 'welcome', token: this.seatToken });
      this.handlers.onJoin?.(conn.peer, rejoin);
    });
  }

  /** Host: the seat is free again (the player left for good). */
  freeSeat() {
    this.seatToken = null;
  }

  private attach(peerId: string, conn: DataConnection) {
    this.links.set(peerId, { conn, lastHeard: performance.now() });
    conn.on('data', (d) => {
      const link = this.links.get(peerId);
      if (!link || link.conn !== conn) return;
      link.lastHeard = performance.now();
      const msg = d as RoomMessage;
      if (!msg || typeof msg.t !== 'string' || msg.t === 'hb') return;
      if (msg.t === 'bye') return this.drop(peerId, 'left', conn);
      this.handlers.onMessage?.(peerId, msg);
    });
    conn.on('close', () => this.drop(peerId, 'lost', conn));
    conn.on('error', () => this.drop(peerId, 'lost', conn));
    // A dead connection can take a long time to report "close"; the heartbeat and ICE state catch it sooner.
    const pc = conn.peerConnection;
    pc?.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') this.drop(peerId, 'lost', conn);
    });
  }

  /** Removes a link without telling anyone (it is being replaced). */
  private forget(peerId: string) {
    const link = this.links.get(peerId);
    if (!link) return;
    this.links.delete(peerId);
    link.conn.close();
  }

  private drop(peerId: string, reason: 'left' | 'lost', conn?: DataConnection) {
    const link = this.links.get(peerId);
    if (!link || (conn && link.conn !== conn)) return;
    this.links.delete(peerId);
    link.conn.close();
    if (!this.closed) this.handlers.onLeave?.(peerId, reason);
  }

  private heartbeat() {
    const now = performance.now();
    for (const [id, link] of this.links) {
      if (now - link.lastHeard > SILENCE_LIMIT_MS) this.drop(id, 'lost');
      else if (link.conn.open) link.conn.send({ t: 'hb' });
    }
  }

  private signalingRetry: number | undefined;
  private keepSignaling() {
    if (this.signalingRetry !== undefined) return;
    this.signalingRetry = window.setInterval(() => {
      if (this.closed || this.peer.destroyed) return window.clearInterval(this.signalingRetry);
      if (!this.peer.disconnected) {
        window.clearInterval(this.signalingRetry);
        this.signalingRetry = undefined;
        return;
      }
      try {
        this.peer.reconnect();
      } catch {
        // Tried again on the next round.
      }
    }, 3000);
  }

  get connected() {
    return this.links.size > 0;
  }

  /** This device has lost the signaling server (a sign that its own internet is down). */
  get offline() {
    return this.peer.disconnected || this.peer.destroyed || !navigator.onLine;
  }

  send(msg: RoomMessage) {
    for (const link of this.links.values()) if (link.conn.open) link.conn.send(msg);
  }

  /** Leaves the room. Tells the other side first, so they know it was on purpose. */
  close() {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.beat);
    window.clearInterval(this.signalingRetry);
    for (const link of this.links.values()) if (link.conn.open) link.conn.send({ t: 'bye' });
    const links = [...this.links.values()];
    this.links.clear();
    // Give the goodbye a moment to go out before the connection closes.
    window.setTimeout(() => {
      links.forEach((l) => l.conn.close());
      this.peer.destroy();
    }, 250);
  }

  /** Drops everything without saying goodbye (a guest giving up on a dead connection). */
  abandon() {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.beat);
    window.clearInterval(this.signalingRetry);
    for (const link of this.links.values()) link.conn.close();
    this.links.clear();
    this.peer.destroy();
  }
}

function opened(peer: Peer, timeoutMs = CONNECT_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject({ type: 'timeout' }), timeoutMs);
    peer.once('open', () => {
      window.clearTimeout(timer);
      resolve();
    });
    peer.once('error', (e) => {
      window.clearTimeout(timer);
      reject(e);
    });
  });
}

function signalingMessage(e: unknown): string {
  const type = (e as { type?: string } | undefined)?.type;
  if (type === 'browser-incompatible') return 'This browser cannot make direct connections (WebRTC).';
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed' || type === 'timeout')
    return 'Could not reach the room server. Check the internet connection and try again.';
  if (type === 'unavailable-id') return 'Could not get a free room code. Try again.';
  return 'Something went wrong connecting. Try again.';
}
