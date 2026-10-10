import { useRef, type ChangeEvent } from 'react';
import { Icons } from './Icons';
import { formatBytes } from '../lib/format';
import type { SharedFile } from '../types';

interface Props {
  files: SharedFile[];
  /** 0..1 while a file is being sent, null otherwise. */
  progress: number | null;
  canSend: boolean;
  onSend: (file: File) => void;
}

export default function FilePanel({ files, progress, canSend, onSend }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sending = progress !== null;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (file) onSend(file);
  };

  return (
    <div className="flex flex-col h-full bg-transparent p-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={!canSend || sending}
        className="w-full flex flex-col items-center justify-center gap-3 bg-slate-800/50 border-2 border-dashed border-slate-600/50 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-slate-300 py-8 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6 group shadow-inner"
      >
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Icons.File className="w-6 h-6 text-indigo-400" />
        </div>
        <span className="font-semibold text-sm tracking-wide">
          {sending ? `Sending… ${Math.round((progress ?? 0) * 100)}%` : canSend ? 'Choose a file to share' : 'File sharing opens once someone joins'}
        </span>
        {sending && (
          <div className="w-2/3 h-1.5 rounded-full bg-slate-700 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-indigo-500 transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
        )}
      </button>
      <input type="file" ref={inputRef} onChange={handleChange} className="hidden" />

      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
        <div className="text-sm font-semibold text-slate-400 mb-3 pl-1">Shared files</div>
        {files.length === 0 && <div className="text-sm text-slate-500 pl-1">Nothing shared yet.</div>}
        {files.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-3 p-3.5 bg-slate-800/80 rounded-xl border border-white/5 shadow-sm hover:border-white/10 transition-colors"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-200">{f.name}</div>
              <div className="text-xs text-slate-500">
                {formatBytes(f.size)} · {f.isSender ? 'Sent by you' : 'Received'}
              </div>
            </div>
            <a
              href={f.url}
              download={f.name}
              className="text-indigo-400 hover:text-white hover:bg-indigo-500 text-xs font-bold shrink-0 bg-indigo-500/10 px-3 py-1.5 rounded-lg transition-colors border border-indigo-500/20"
            >
              Save
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
