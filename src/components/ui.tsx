import type { ReactNode } from 'react';
import { Icons } from './Icons';
import type { ToastState } from '../hooks/useToast';

const TONES = {
  neutral: 'bg-slate-700/50 hover:bg-slate-600 text-slate-200',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  accent: 'bg-indigo-500 text-white hover:bg-indigo-600',
} as const;

interface ControlButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: keyof typeof TONES;
  pressed?: boolean;
}

export function ControlButton({ icon, label, onClick, tone = 'neutral', pressed }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all active:scale-95 shadow-sm border border-white/5 ${TONES[tone]}`}
    >
      {icon}
    </button>
  );
}

interface TabButtonProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}

export function TabButton({ active, icon, label, badge = 0, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
        active
          ? 'bg-indigo-500/20 text-indigo-400 shadow-inner border border-indigo-500/20'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      {icon} {label}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

const TOAST_STYLES = {
  error: 'bg-red-500/90',
  success: 'bg-emerald-500/90',
  info: 'bg-indigo-500/90',
} as const;

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl z-50 text-white backdrop-blur-md border border-white/20 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        toast.show ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0 pointer-events-none'
      } ${TOAST_STYLES[toast.type]}`}
    >
      {toast.type === 'error' ? <Icons.Alert /> : <Icons.Check />}
      <span className="font-semibold text-sm">{toast.message}</span>
    </div>
  );
}
