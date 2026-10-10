import { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { ControlButton, TabButton, Toast } from './ui';
import ChatPanel from './ChatPanel';
import FilePanel from './FilePanel';
import WhiteboardPanel, { type WhiteboardHandle } from './WhiteboardPanel';
import { useRoom } from '../hooks/useRoom';
import { useMediaControls } from '../hooks/useMediaControls';
import { useToast } from '../hooks/useToast';
import { copyText } from '../lib/clipboard';
import { parseMessage } from '../lib/messages';
import { MAX_FILE_SIZE } from '../lib/rtc';
import { createFileReceiver, sendFile, type FileReceiver } from '../lib/transfer';
import {
  STATUS_LABEL,
  TERMINAL_STATUSES,
  type ChatMessage,
  type PeerEvent,
  type RoomStatus,
  type Session,
  type SharedFile,
  type TabId,
} from '../types';

interface Props {
  uid: string;
  session: Session;
  onLeave: () => void;
}

function chipLabel(status: RoomStatus): string {
  switch (status) {
    case 'connected':
      return 'Live';
    case 'waiting':
      return 'Waiting';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return 'Reconnecting';
    case 'initializing':
      return 'Starting';
    default:
      return 'Offline';
  }
}

export default function ConferenceRoom({ uid, session, onLeave }: Props) {
  const { toast, showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const activeTabRef = useRef<TabId>('chat');
  const [unread, setUnread] = useState({ chat: 0, files: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [progress, setProgress] = useState<number | null>(null);

  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const idRef = useRef(0);

  const bumpUnread = (tab: 'chat' | 'files') => {
    if (activeTabRef.current !== tab) setUnread((u) => ({ ...u, [tab]: u[tab] + 1 }));
  };

  const selectTab = (tab: TabId) => {
    activeTabRef.current = tab;
    setActiveTab(tab);
    if (tab === 'chat' || tab === 'files') setUnread((u) => ({ ...u, [tab]: 0 }));
  };

  const receiverRef = useRef<FileReceiver | null>(null);
  if (receiverRef.current === null) {
    receiverRef.current = createFileReceiver((name, blob) => {
      const url = URL.createObjectURL(blob);
      setFiles((prev) => [...prev, { id: ++idRef.current, name, url, size: blob.size, isSender: false }]);
      bumpUnread('files');
      showToast(`Received ${name}`, 'success');
    });
  }

  const handleData = (data: string | ArrayBuffer) => {
    if (typeof data !== 'string') {
      receiverRef.current?.push(data);
      return;
    }
    const msg = parseMessage(data);
    if (!msg) return;
    switch (msg.type) {
      case 'chat':
        setMessages((prev) => [...prev, { id: ++idRef.current, from: 'peer', text: msg.text, ts: Date.now() }]);
        bumpUnread('chat');
        break;
      case 'draw':
        whiteboardRef.current?.addSegment(msg);
        break;
      case 'clear_canvas':
        whiteboardRef.current?.clear();
        break;
      case 'file_meta':
        if (receiverRef.current?.begin(msg.file) === false) {
          showToast('The other person tried to send a file over 100 MB. It was skipped.', 'error');
        }
        break;
    }
  };

  const handlePeerEvent = (event: PeerEvent) => {
    if (event === 'connected') showToast('Connected to the other person', 'success');
    else if (event === 'peer-left') showToast('The other person left the call', 'error');
    else showToast('The connection was lost', 'error');
  };

  const { roomId, status, detail, remoteStream, channelOpen, pcRef, channelRef, sendMessage, localStream } = useRoom({
    uid,
    session,
    onData: handleData,
    onPeerEvent: handlePeerEvent,
  });

  const media = useMediaControls(localStream, pcRef);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = media.previewStream;
  }, [media.previewStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Release blob URLs for shared files when leaving.
  const filesRef = useRef<SharedFile[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(
    () => () => {
      filesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    },
    [],
  );

  const handleSendChat = (text: string): boolean => {
    if (!sendMessage({ type: 'chat', text })) {
      showToast('Not connected yet. Try again in a moment.', 'error');
      return false;
    }
    setMessages((prev) => [...prev, { id: ++idRef.current, from: 'me', text, ts: Date.now() }]);
    return true;
  };

  const handleSendFile = async (file: File) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') {
      showToast('Not connected yet. Try again in a moment.', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(`Files over ${MAX_FILE_SIZE / (1024 * 1024)} MB can’t be shared.`, 'error');
      return;
    }
    setProgress(0);
    try {
      await sendFile(channel, file, setProgress);
      setFiles((prev) => [
        ...prev,
        { id: ++idRef.current, name: file.name, url: URL.createObjectURL(file), size: file.size, isSender: true },
      ]);
      showToast('File sent', 'success');
    } catch (err) {
      console.error('File transfer failed', err);
      showToast('File transfer failed. Check your connection and try again.', 'error');
    } finally {
      setProgress(null);
    }
  };

  const copy = async (text: string, success: string) => {
    const ok = await copyText(text);
    showToast(ok ? success : 'Couldn’t copy. Select the text and copy it manually.', ok ? 'success' : 'error');
  };

  const inviteLink = roomId ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : '';
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const showPlaceholder = !remoteStream || isTerminal;

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#0B0F19] relative">
      <Toast toast={toast} />

      {/* Main video area */}
      <main className="flex-1 min-h-0 flex flex-col relative p-4 md:p-6 pb-24 md:pb-6 gap-4">
        <div className="flex-1 min-h-0 bg-slate-900/50 rounded-3xl relative flex items-center justify-center overflow-hidden border border-white/5 shadow-2xl backdrop-blur-sm">
          {showPlaceholder && (
            <div className="flex flex-col items-center justify-center z-10 text-slate-400 text-center px-6 max-w-md">
              <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-700/50">
                <Icons.VideoOff className="w-8 h-8 opacity-50" />
              </div>
              <p className="font-medium">{STATUS_LABEL[status]}</p>
              {detail && <p className="text-sm text-slate-500 mt-2">{detail}</p>}
              {status === 'waiting' && (
                <p className="text-sm text-slate-500 mt-2">Share the room ID or invite link from the top left.</p>
              )}
              {isTerminal && (
                <button
                  type="button"
                  onClick={onLeave}
                  className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  Back to start
                </button>
              )}
            </div>
          )}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-contain z-10 ${showPlaceholder ? 'hidden' : ''}`}
          />

          {/* Room info and status */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start gap-3 z-20 pointer-events-none">
            <div className="flex items-center gap-1.5 pointer-events-auto bg-black/40 backdrop-blur-md rounded-xl p-1.5 border border-white/10 shadow-lg min-w-0">
              <span className="px-3 py-1 text-sm font-mono text-slate-300 font-medium tracking-wider truncate">
                {roomId || 'Creating room…'}
              </span>
              <button
                type="button"
                disabled={!roomId}
                onClick={() => copy(roomId, 'Room ID copied')}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-slate-300 disabled:opacity-40"
                title="Copy room ID"
                aria-label="Copy room ID"
              >
                <Icons.Copy />
              </button>
              <button
                type="button"
                disabled={!roomId}
                onClick={() => copy(inviteLink, 'Invite link copied')}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-slate-300 disabled:opacity-40"
                title="Copy invite link"
                aria-label="Copy invite link"
              >
                <Icons.Link />
              </button>
            </div>
            <div
              className={`text-sm font-semibold px-3 py-1.5 rounded-lg border backdrop-blur-md shadow-lg shrink-0 ${
                status === 'connected'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : isTerminal
                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}
            >
              {chipLabel(status)}
            </div>
          </div>
        </div>

        {/* Your camera */}
        <div className="absolute bottom-28 md:bottom-10 right-8 md:right-10 w-32 md:w-56 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-30">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full ${media.isScreenSharing ? 'object-contain' : 'object-cover -scale-x-100'} ${
              media.isVideoOff && !media.isScreenSharing ? 'opacity-0' : 'opacity-100'
            }`}
          />
          {media.isVideoOff && !media.isScreenSharing && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <Icons.VideoOff className="text-slate-500 w-8 h-8" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-semibold text-white">
            {media.isScreenSharing ? 'Your screen' : 'You'}
          </div>
        </div>

        {/* Call controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/10 z-40 shadow-2xl">
          <ControlButton
            label={media.isMuted ? 'Unmute microphone' : 'Mute microphone'}
            pressed={media.isMuted}
            tone={media.isMuted ? 'danger' : 'neutral'}
            onClick={media.toggleMute}
            icon={media.isMuted ? <Icons.MicOff /> : <Icons.Mic />}
          />
          <ControlButton
            label={media.isVideoOff ? 'Turn camera on' : 'Turn camera off'}
            pressed={media.isVideoOff}
            tone={media.isVideoOff ? 'danger' : 'neutral'}
            onClick={media.toggleVideo}
            icon={media.isVideoOff ? <Icons.VideoOff /> : <Icons.Video />}
          />
          {media.canShareScreen && (
            <ControlButton
              label={media.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
              pressed={media.isScreenSharing}
              tone={media.isScreenSharing ? 'accent' : 'neutral'}
              onClick={media.toggleScreenShare}
              icon={<Icons.Monitor />}
            />
          )}
          <div className="w-px h-8 bg-white/10 mx-1" />
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg active:scale-95"
            title="Leave call"
            aria-label="Leave call"
          >
            <Icons.PhoneOff />
          </button>
        </div>
      </main>

      {/* Sidebar */}
      <aside className="w-full md:w-96 h-[42%] md:h-full bg-slate-900/40 backdrop-blur-md border-t md:border-t-0 md:border-l border-white/5 flex flex-col z-20 shadow-2xl">
        <div className="flex p-3 gap-2 bg-black/20" role="tablist" aria-label="Collaboration tools">
          <TabButton active={activeTab === 'chat'} onClick={() => selectTab('chat')} icon={<Icons.Message />} label="Chat" badge={unread.chat} />
          <TabButton active={activeTab === 'files'} onClick={() => selectTab('files')} icon={<Icons.File />} label="Files" badge={unread.files} />
          <TabButton active={activeTab === 'board'} onClick={() => selectTab('board')} icon={<Icons.PenTool />} label="Board" />
        </div>

        <div className="flex-1 min-h-0 relative">
          {activeTab === 'chat' && (
            <div className="absolute inset-0">
              <ChatPanel messages={messages} canSend={channelOpen} onSend={handleSendChat} />
            </div>
          )}
          {activeTab === 'files' && (
            <div className="absolute inset-0">
              <FilePanel files={files} progress={progress} canSend={channelOpen} onSend={handleSendFile} />
            </div>
          )}
          {/* The board stays mounted (just hidden) so drawings persist between tab switches. */}
          <div className={`absolute inset-0 ${activeTab === 'board' ? 'block' : 'hidden'}`}>
            <WhiteboardPanel
              ref={whiteboardRef}
              onStroke={(s) => sendMessage({ type: 'draw', ...s })}
              onClear={() => sendMessage({ type: 'clear_canvas' })}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
