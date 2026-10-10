export type Session = { mode: 'create' } | { mode: 'join'; roomId: string };

export type RoomStatus =
  | 'initializing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'failed'
  | 'media-denied'
  | 'not-found'
  | 'room-full'
  | 'error';

export const STATUS_LABEL: Record<RoomStatus, string> = {
  initializing: 'Starting your camera…',
  waiting: 'Waiting for someone to join…',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Connection is unstable. Trying to reconnect…',
  ended: 'The other person left the call.',
  failed: 'Could not connect. This network may need a TURN server.',
  'media-denied': 'Camera or microphone unavailable. Allow access in your browser (needs https or localhost).',
  'not-found': 'Room not found. Check the room ID and try again.',
  'room-full': 'This room already has two people in it.',
  error: 'Could not set up the call.',
};

/** Statuses where the call cannot continue and the person should go back. */
export const TERMINAL_STATUSES: readonly RoomStatus[] = [
  'ended',
  'failed',
  'media-denied',
  'not-found',
  'room-full',
  'error',
];

export type PeerEvent = 'connected' | 'peer-left' | 'failed';

export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
}

export interface FileMeta {
  name: string;
  size: number;
  type: string;
}

export type DataMessage =
  | { type: 'chat'; text: string }
  | ({ type: 'draw' } & Segment)
  | { type: 'clear_canvas' }
  | { type: 'file_meta'; file: FileMeta };

export interface ChatMessage {
  id: number;
  from: 'me' | 'peer';
  text: string;
  ts: number;
}

export interface SharedFile {
  id: number;
  name: string;
  url: string;
  size: number;
  isSender: boolean;
}

export type TabId = 'chat' | 'files' | 'board';
