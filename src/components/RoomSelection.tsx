import { useState, type FormEvent } from 'react';
import { Icons } from './Icons';

interface Props {
  initialRoomId: string;
  onCreate: () => void;
  onJoin: (roomId: string) => void;
}

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export default function RoomSelection({ initialRoomId, onCreate, onJoin }: Props) {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [error, setError] = useState('');

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    const id = roomId.trim();
    if (!id) {
      setError('Enter a room ID to join.');
      return;
    }
    if (!ROOM_ID_PATTERN.test(id)) {
      setError('That doesn’t look like a room ID. Copy it again from the host.');
      return;
    }
    onJoin(id);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full backdrop-blur-xl bg-slate-900/50 rounded-3xl shadow-2xl p-10 border border-white/5 relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-6 border border-indigo-500/20 shadow-inner">
            <Icons.Monitor className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-3">CollabMeet</h1>
          <p className="text-slate-400 font-medium">Video calls with chat, files and a shared whiteboard</p>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="group w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
        >
          <Icons.Video className="w-5 h-5 group-hover:scale-110 transition-transform" />
          Create new room
        </button>

        <div className="relative flex items-center justify-center my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700/50" />
          </div>
          <div className="relative px-4 text-sm font-medium text-slate-500 backdrop-blur-md">or</div>
        </div>

        <form onSubmit={handleJoin} className="space-y-4" noValidate>
          <div>
            <label htmlFor="room-id" className="sr-only">
              Room ID
            </label>
            <input
              id="room-id"
              type="text"
              placeholder="Paste a room ID"
              autoComplete="off"
              spellCheck={false}
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setError('');
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'room-id-error' : undefined}
              className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-5 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-center tracking-wider"
            />
            {error && (
              <p id="room-id-error" className="text-red-400 text-sm mt-3 font-medium text-center">
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] border border-white/5"
          >
            Join room
          </button>
        </form>
      </div>
    </div>
  );
}
