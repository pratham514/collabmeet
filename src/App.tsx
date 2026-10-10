import { useState, type ReactNode } from 'react';
import ConferenceRoom from './components/ConferenceRoom';
import RoomSelection from './components/RoomSelection';
import { useAuth } from './hooks/useAuth';
import { isFirebaseConfigured } from './lib/firebase';
import type { Session } from './types';

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full bg-[#0B0F19] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B0F19] to-black font-sans text-slate-100 overflow-hidden flex flex-col selection:bg-indigo-500/30">
      {children}
    </div>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-slate-900/60 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-white mb-3">{title}</h1>
        <div className="text-slate-300 text-sm leading-relaxed space-y-3">{children}</div>
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <Shell>
      <Message title="Connect Firebase to start">
        <p>CollabMeet uses Firebase to introduce two browsers to each other. No Firebase settings were found.</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Copy <code className="font-mono text-indigo-300">.env.example</code> to <code className="font-mono text-indigo-300">.env</code>.</li>
          <li>Paste your web app config from the Firebase console (Project settings, Your apps).</li>
          <li>Enable Anonymous sign-in and create a Firestore database.</li>
          <li>Publish <code className="font-mono text-indigo-300">firestore.rules</code>, then restart <code className="font-mono text-indigo-300">npm run dev</code>.</li>
        </ol>
        <p className="text-slate-400">The README has the full walkthrough.</p>
      </Message>
    </Shell>
  );
}

function initialRoomIdFromUrl(): string {
  return new URLSearchParams(window.location.search).get('room')?.trim() ?? '';
}

function AuthedApp() {
  const { user, loading, error } = useAuth();
  const [session, setSession] = useState<Session | null>(null);

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-medium">Connecting…</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Message title="Couldn’t sign in">
          <p>{error ?? 'Sign-in failed. Reload the page to try again.'}</p>
        </Message>
      </Shell>
    );
  }

  return (
    <Shell>
      {session === null ? (
        <RoomSelection
          initialRoomId={initialRoomIdFromUrl()}
          onCreate={() => setSession({ mode: 'create' })}
          onJoin={(roomId) => setSession({ mode: 'join', roomId })}
        />
      ) : (
        <ConferenceRoom uid={user.uid} session={session} onLeave={() => setSession(null)} />
      )}
    </Shell>
  );
}

export default function App() {
  if (!isFirebaseConfigured) return <SetupNotice />;
  return <AuthedApp />;
}
