export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB, files are buffered in memory
export const CHUNK_SIZE = 16 * 1024; // safe cross-browser data channel message size
export const MAX_BUFFERED = 1024 * 1024; // pause sending above this much queued data
export const BUFFER_LOW = 256 * 1024; // resume sending below this

export function buildRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }

  return { iceServers };
}
