import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

/** Mic, camera and screen-share controls for an active call. */
export function useMediaControls(
  localStream: MediaStream | null,
  pcRef: MutableRefObject<RTCPeerConnection | null>,
) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);

  const localRef = useRef<MediaStream | null>(localStream);
  useEffect(() => {
    localRef.current = localStream;
  }, [localStream]);

  const canShareScreen =
    typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  const toggleMute = () => {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  };

  const toggleVideo = () => {
    const track = localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsVideoOff(!track.enabled);
  };

  const stopScreenShare = useCallback(async () => {
    const display = screenRef.current;
    if (!display) return;
    screenRef.current = null;
    display.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });

    const cameraTrack = localRef.current?.getVideoTracks()[0];
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
    if (sender && cameraTrack) {
      try {
        await sender.replaceTrack(cameraTrack);
      } catch (err) {
        console.warn('Could not restore camera track', err);
      }
    }
    setScreenStream(null);
  }, [pcRef]);

  const startScreenShare = useCallback(async () => {
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
    if (!sender) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      await sender.replaceTrack(track);
      screenRef.current = display;
      track.onended = () => {
        void stopScreenShare(); // person clicked the browser's "Stop sharing"
      };
      setScreenStream(display);
    } catch {
      // The picker was dismissed or permission was refused; nothing to do.
    }
  }, [pcRef, stopScreenShare]);

  const toggleScreenShare = () => {
    if (screenRef.current) void stopScreenShare();
    else void startScreenShare();
  };

  useEffect(
    () => () => {
      screenRef.current?.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
    },
    [],
  );

  return {
    isMuted,
    isVideoOff,
    isScreenSharing: screenStream !== null,
    canShareScreen,
    previewStream: screenStream ?? localStream,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  };
}
