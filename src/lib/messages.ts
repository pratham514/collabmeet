import type { DataMessage } from '../types';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Parse and validate a JSON message from the peer. Returns null for anything unexpected. */
export function parseMessage(raw: string): DataMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const m = parsed as Record<string, unknown>;

  switch (m.type) {
    case 'chat':
      return typeof m.text === 'string' ? { type: 'chat', text: m.text.slice(0, 4000) } : null;

    case 'draw':
      if (
        isNum(m.x0) &&
        isNum(m.y0) &&
        isNum(m.x1) &&
        isNum(m.y1) &&
        typeof m.color === 'string' &&
        /^#[0-9a-f]{6}$/i.test(m.color)
      ) {
        return {
          type: 'draw',
          x0: clamp01(m.x0),
          y0: clamp01(m.y0),
          x1: clamp01(m.x1),
          y1: clamp01(m.y1),
          color: m.color,
        };
      }
      return null;

    case 'clear_canvas':
      return { type: 'clear_canvas' };

    case 'file_meta': {
      const f = m.file;
      if (typeof f !== 'object' || f === null) return null;
      const file = f as Record<string, unknown>;
      if (typeof file.name === 'string' && isNum(file.size) && file.size >= 0 && typeof file.type === 'string') {
        return {
          type: 'file_meta',
          file: { name: file.name.slice(0, 255), size: file.size, type: file.type },
        };
      }
      return null;
    }

    default:
      return null;
  }
}
