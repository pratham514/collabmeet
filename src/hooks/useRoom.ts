import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { buildRtcConfig } from '../lib/rtc';
import type { DataMessage, PeerEvent, RoomStatus, Session } from '../types';

interface Options {
  uid: string;
  session: Session;
  onData: (data: string | ArrayBuffer) => void;
  onPeerEvent: (event: PeerEvent) => void;
}

function describeError(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code === 'permission-denied') {
    return 'Firestore rejected the request. Publish firestore.rules and make sure anonymous sign-in is enabled.';
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

/** Best-effort removal of a room and its ICE candidate documents. */
async function deleteRoom(ref: DocumentReference): Promise<void> {
  try {
    await deleteDoc(ref); // first, so the other side notices straight away
    for (const name of ['callerCandidates', 'calleeCandidates']) {
      const snap = await getDocs(collection(ref, name));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
  } catch (err) {
    console.warn('Room cleanup failed', err);
  }
}

const warnListener = (err: Error) => console.warn('Firestore listener error', err);

/**
 * Owns the whole call lifecycle: camera/mic, Firestore signaling, the peer
 * connection and the data channel. Everything is torn down on unmount.
 */
export function useRoom({ uid, session, onData, onPeerEvent }: Options) {
  const [roomId, setRoomId] = useState(session.mode === 'join' ? session.roomId : '');
  const [status, setStatus] = useState<RoomStatus>('initializing');
  const [detail, setDetail] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [channelOpen, setChannelOpen] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  // Always call the latest callbacks without restarting the connection.
  const onDataRef = useRef(onData);
  const onPeerEventRef = useRef(onPeerEvent);
  useEffect(() => {
    onDataRef.current = onData;
    onPeerEventRef.current = onPeerEvent;
  });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let pc: RTCPeerConnection | null = null;
    let hostRoomRef: DocumentReference | null = null;
    let channelWasOpen = false;
    let peerLeftNotified = false;
    const unsubs: Unsubscribe[] = [];
    const db = getDb();

    setStatus('initializing');
    setDetail('');
    setRemoteStream(null);
    setChannelOpen(false);

    const notifyPeerLeft = () => {
      if (cancelled || peerLeftNotified) return;
      peerLeftNotified = true;
      setRemoteStream(null);
      setStatus('ended');
      onPeerEventRef.current('peer-left');
    };

    const run = async () => {
      try {
        // Joining: check the room before asking for the camera.
        let guestRoom: { ref: DocumentReference; offer: RTCSessionDescriptionInit } | null = null;
        if (session.mode === 'join') {
          const ref = doc(db, 'rooms', session.roomId);
          const snap = await getDoc(ref);
          if (cancelled) return;
          const data: DocumentData | undefined = snap.data();
          if (!snap.exists() || !data) {
            setStatus('not-found');
            return;
          }
          if (data.answer) {
            setStatus('room-full');
            return;
          }
          guestRoom = { ref, offer: data.offer as RTCSessionDescriptionInit };
        }

        let media: MediaStream;
        try {
          media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err) {
          console.error('Media error:', err);
          if (!cancelled) setStatus('media-denied');
          return;
        }
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = media;
        setLocalStream(media);

        const connection = new RTCPeerConnection(buildRtcConfig());
        pc = connection;
        pcRef.current = connection;
        media.getTracks().forEach((track) => connection.addTrack(track, media));

        connection.ontrack = (event) => {
          if (cancelled) return;
          const [remote] = event.streams;
          if (remote) setRemoteStream(remote);
        };

        connection.onconnectionstatechange = () => {
          if (cancelled || peerLeftNotified) return;
          switch (connection.connectionState) {
            case 'connected':
              setStatus('connected');
              onPeerEventRef.current('connected');
              break;
            case 'disconnected':
              setStatus('reconnecting');
              break;
            case 'failed':
              setRemoteStream(null);
              setStatus('failed');
              onPeerEventRef.current('failed');
              break;
            default:
              break;
          }
        };

        // Candidates can arrive before the remote description is set; hold them until it is.
        const pendingCandidates: RTCIceCandidateInit[] = [];
        const addRemoteCandidate = (candidate: RTCIceCandidateInit) => {
          if (connection.remoteDescription) {
            connection.addIceCandidate(candidate).catch((e) => console.warn('ICE candidate rejected', e));
          } else {
            pendingCandidates.push(candidate);
          }
        };
        const flushCandidates = () => {
          pendingCandidates.splice(0).forEach((c) => {
            connection.addIceCandidate(c).catch((e) => console.warn('ICE candidate rejected', e));
          });
        };

        const attachChannel = (dc: RTCDataChannel) => {
          dc.binaryType = 'arraybuffer';
          channelRef.current = dc;
          dc.onopen = () => {
            if (cancelled) return;
            channelWasOpen = true;
            setChannelOpen(true);
          };
          dc.onclose = () => {
            if (cancelled) return;
            setChannelOpen(false);
            if (channelWasOpen) notifyPeerLeft();
          };
          dc.onmessage = (event) => {
            if (!cancelled) onDataRef.current(event.data as string | ArrayBuffer);
          };
        };

        const watchCandidates = (ref: DocumentReference, name: 'callerCandidates' | 'calleeCandidates') => {
          unsubs.push(
            onSnapshot(
              collection(ref, name),
              (snap) => {
                snap.docChanges().forEach((change) => {
                  if (change.type === 'added') addRemoteCandidate(change.doc.data() as RTCIceCandidateInit);
                });
              },
              warnListener,
            ),
          );
        };

        if (session.mode === 'create') {
          // ---- Host: publish an offer, wait for an answer ----
          const roomRef = doc(collection(db, 'rooms'));
          hostRoomRef = roomRef;
          setRoomId(roomRef.id);

          attachChannel(connection.createDataChannel('collab'));

          connection.onicecandidate = (event) => {
            if (event.candidate) {
              addDoc(collection(roomRef, 'callerCandidates'), event.candidate.toJSON()).catch((e) =>
                console.warn('Could not publish ICE candidate', e),
              );
            }
          };

          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          await setDoc(roomRef, {
            offer: { type: offer.type, sdp: offer.sdp },
            hostId: uid,
            createdAt: serverTimestamp(),
          });
          if (cancelled) {
            void deleteRoom(roomRef); // unmounted while the room was being created
            return;
          }
          setStatus('waiting');

          let answered = false;
          unsubs.push(
            onSnapshot(
              roomRef,
              (snap) => {
                const data = snap.data();
                if (!answered && data?.answer) {
                  answered = true;
                  setStatus('connecting');
                  connection
                    .setRemoteDescription(data.answer as RTCSessionDescriptionInit)
                    .then(flushCandidates)
                    .catch((e) => {
                      console.error('Could not apply answer', e);
                      if (!cancelled) {
                        setDetail(describeError(e));
                        setStatus('error');
                      }
                    });
                }
              },
              warnListener,
            ),
          );
          watchCandidates(roomRef, 'calleeCandidates');
        } else if (guestRoom) {
          // ---- Guest: answer the host's offer ----
          const { ref: roomRef, offer } = guestRoom;

          connection.ondatachannel = (event) => attachChannel(event.channel);
          connection.onicecandidate = (event) => {
            if (event.candidate) {
              addDoc(collection(roomRef, 'calleeCandidates'), event.candidate.toJSON()).catch((e) =>
                console.warn('Could not publish ICE candidate', e),
              );
            }
          };

          await connection.setRemoteDescription(offer);
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);

          try {
            await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp }, guestId: uid });
          } catch (err) {
            // Rules only allow the first guest to answer, so a rejection means someone beat us to it.
            const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
            if (!cancelled) setStatus(code === 'permission-denied' ? 'room-full' : 'error');
            if (code !== 'permission-denied') throw err;
            return;
          }
          if (cancelled) return;
          setStatus('connecting');

          watchCandidates(roomRef, 'callerCandidates');
          // The host deletes the room when they leave, which is the fastest "left" signal.
          unsubs.push(
            onSnapshot(
              roomRef,
              (snap) => {
                if (!snap.exists()) notifyPeerLeft();
              },
              warnListener,
            ),
          );
        }
      } catch (err) {
        console.error('Room setup failed:', err);
        if (!cancelled) {
          setDetail(describeError(err));
          setStatus('error');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      if (pc) {
        pc.onconnectionstatechange = null;
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
      }
      pcRef.current = null;
      channelRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      if (hostRoomRef) void deleteRoom(hostRoomRef);
    };
  }, [uid, session]);

  const sendMessage = useCallback((msg: DataMessage): boolean => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') return false;
    channel.send(JSON.stringify(msg));
    return true;
  }, []);

  return { roomId, status, detail, localStream, remoteStream, channelOpen, pcRef, channelRef, sendMessage };
}
