import type { FileMeta } from '../types';
import { BUFFER_LOW, CHUNK_SIZE, MAX_BUFFERED, MAX_FILE_SIZE } from './rtc';

function waitForDrain(channel: RTCDataChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      channel.removeEventListener('bufferedamountlow', onLow);
      channel.removeEventListener('close', onClose);
    };
    const onLow = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error('Connection closed during transfer'));
    };
    channel.addEventListener('bufferedamountlow', onLow);
    channel.addEventListener('close', onClose);
  });
}

/**
 * Send a file over a data channel in chunks, pausing while the channel's send
 * buffer is full so large files don't overflow it and kill the connection.
 */
export async function sendFile(
  channel: RTCDataChannel,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const meta: FileMeta = { name: file.name, size: file.size, type: file.type };
  channel.send(JSON.stringify({ type: 'file_meta', file: meta }));
  channel.bufferedAmountLowThreshold = BUFFER_LOW;

  let offset = 0;
  while (offset < file.size) {
    if (channel.readyState !== 'open') throw new Error('Connection closed during transfer');
    if (channel.bufferedAmount > MAX_BUFFERED) await waitForDrain(channel);

    const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
    channel.send(chunk);
    offset += chunk.byteLength;
    onProgress(offset / file.size);
  }
  onProgress(1);
}

export interface FileReceiver {
  /** Start receiving a file. Returns false if the file was rejected (too large). */
  begin(meta: FileMeta): boolean;
  push(chunk: ArrayBuffer): void;
}

export function createFileReceiver(onComplete: (name: string, blob: Blob) => void): FileReceiver {
  let meta: FileMeta | null = null;
  let chunks: ArrayBuffer[] = [];
  let received = 0;

  const reset = () => {
    meta = null;
    chunks = [];
    received = 0;
  };

  const finish = () => {
    if (!meta) return;
    const safeName = meta.name.replace(/[\\/:*?"<>|]/g, '_') || 'file';
    const blob = new Blob(chunks, { type: meta.type });
    reset();
    onComplete(safeName, blob);
  };

  return {
    begin(next) {
      reset();
      if (next.size > MAX_FILE_SIZE) return false;
      meta = next;
      if (next.size === 0) finish();
      return true;
    },
    push(chunk) {
      if (!meta) return;
      chunks.push(chunk);
      received += chunk.byteLength;
      if (received >= meta.size) finish();
    },
  };
}
