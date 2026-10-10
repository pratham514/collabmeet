import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Segment } from '../types';

export interface WhiteboardHandle {
  addSegment: (segment: Segment) => void;
  clear: () => void;
}

interface Props {
  onStroke: (segment: Segment) => void;
  onClear: () => void;
}

const BACKGROUND = '#0f172a';
const COLORS = ['#ffffff', '#818cf8', '#34d399', '#fbbf24', '#f87171'];
const MAX_SEGMENTS = 40000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function paint(ctx: CanvasRenderingContext2D, s: Segment) {
  const { width, height } = ctx.canvas;
  ctx.beginPath();
  ctx.moveTo(s.x0 * width, s.y0 * height);
  ctx.lineTo(s.x1 * width, s.y1 * height);
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 3 * (window.devicePixelRatio || 1);
  ctx.lineCap = 'round';
  ctx.stroke();
}

const WhiteboardPanel = forwardRef<WhiteboardHandle, Props>(function WhiteboardPanel({ onStroke, onClear }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Strokes are stored in normalized (0..1) coordinates so the board can be
  // redrawn at any size, e.g. after the tab becomes visible or the window resizes.
  const segments = useRef<Segment[]>([]);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[1]);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    segments.current.forEach((s) => paint(ctx, s));
  }, []);

  const addSegment = useCallback((segment: Segment) => {
    segments.current.push(segment);
    if (segments.current.length > MAX_SEGMENTS) segments.current.splice(0, segments.current.length - MAX_SEGMENTS);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && ctx.canvas.width > 0) paint(ctx, segment);
  }, []);

  const clear = useCallback(() => {
    segments.current = [];
    repaint();
  }, [repaint]);

  useImperativeHandle(ref, () => ({ addSegment, clear }), [addSegment, clear]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return; // tab is hidden; wait until it has a size
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      repaint();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [repaint]);

  const pointFrom = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  };

  const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const segment: Segment = { x0: from.x, y0: from.y, x1: to.x, y1: to.y, color };
    addSegment(segment);
    onStroke(segment);
  };

  const handleDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pointFrom(e);
    last.current = p;
    draw(p, p); // a click without movement leaves a dot
  };

  const handleMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const p = pointFrom(e);
    draw(last.current, p);
    last.current = p;
  };

  const handleUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    last.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleClear = () => {
    clear();
    onClear();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 relative overflow-hidden">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-4 border border-white/10 shadow-xl z-10">
        <div className="flex gap-2" role="group" aria-label="Pen color">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Pen color ${c}`}
              aria-pressed={color === c}
              className={`w-6 h-6 rounded-full transition-all duration-200 ${
                color === c ? 'scale-125 ring-2 ring-white/50 shadow-lg' : 'opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="w-px h-5 bg-white/10" />
        <button
          type="button"
          onClick={handleClear}
          className="text-sm font-semibold text-slate-300 hover:text-white transition-colors"
        >
          Clear board
        </button>
      </div>
      <div ref={containerRef} className="relative flex-1 min-h-0 w-full cursor-crosshair">
        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          className="absolute inset-0 w-full h-full touch-none"
        />
      </div>
    </div>
  );
});

export default WhiteboardPanel;
