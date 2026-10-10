import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icons } from './Icons';
import { formatTime } from '../lib/format';
import type { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  canSend: boolean;
  onSend: (text: string) => boolean;
}

export default function ChatPanel({ messages, canSend, onSend }: Props) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !canSend) return;
    if (onSend(trimmed)) setText('');
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
            <Icons.Message className="w-12 h-12 mb-3" />
            <span className="text-sm font-medium">No messages yet.</span>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.from === 'me';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
                  mine
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-white/5'
                }`}
              >
                <div className={`text-[11px] font-semibold mb-1 ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {mine ? 'You' : 'Them'} · {formatTime(m.ts)}
                </div>
                <div className="leading-relaxed whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-4 bg-black/20 backdrop-blur-md border-t border-white/5">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-input"
          type="text"
          value={text}
          maxLength={2000}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          placeholder={canSend ? 'Type a message…' : 'Chat opens once someone joins'}
          disabled={!canSend}
          className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
        />
      </form>
    </div>
  );
}
