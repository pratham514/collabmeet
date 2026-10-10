# CollabMeet

One-to-one video calls in the browser with chat, file sharing and a shared whiteboard.
Video, audio, chat, files and drawing all travel peer to peer over WebRTC. Firebase is
only used to introduce the two browsers to each other (signaling).

Stack: React 18, TypeScript, Vite, Tailwind CSS 3, Firebase (anonymous auth + Firestore).

## Run it

You need Node 18 or newer.

```bash
npm install
cp .env.example .env      # then fill in your Firebase values (see below)
npm run dev
```

Open http://localhost:5173, click **Create new room**, copy the invite link, and open it in a
second browser window (a private window or a different browser works best on one computer).

## Firebase setup (about 5 minutes)

1. Go to the [Firebase console](https://console.firebase.google.com), create a project, and add a **Web app**.
2. Copy the config values it shows into `.env` (names are in `.env.example`).
3. **Authentication > Sign-in method:** enable **Anonymous**.
4. **Firestore Database:** create a database (production mode is fine).
5. Publish the security rules in `firestore.rules`. Either paste them into
   Firestore > Rules > Publish, or run:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add          # pick your project
   firebase deploy --only firestore:rules
   ```

The web config values are not secrets. What protects your data is `firestore.rules`: rooms can
be fetched by ID but never listed, only the creator can delete a room, and only one guest can
answer it.

## Deploy

```bash
npm run build               # type-checks, then builds into dist/
firebase deploy --only hosting
```

Any static host works too. The site must be served over **https** (or localhost), because
browsers only allow camera and microphone access on secure origins. If you deploy to your own
domain, add it under Authentication > Settings > Authorized domains.

## Good to know

- **Two people per room.** Once a guest has joined, the room is full. If someone leaves, create a new room.
- **Strict networks need a TURN server.** The app uses free Google STUN servers, which work on most
  home networks. Some mobile carriers and office networks block direct connections; there the call
  shows "Could not connect". Add a TURN server in `.env` (`VITE_TURN_URL`, `VITE_TURN_USERNAME`,
  `VITE_TURN_CREDENTIAL`) to fix that.
- **Files** go straight to the other person and are limited to 100 MB (they are held in memory while
  transferring). Nothing is stored on a server.
- **Screen sharing** is hidden on browsers that don't support it (most phones).
- If a host closes the tab abruptly, their room document can be left behind in Firestore. It is
  harmless, and you can delete it from the console.

## Project layout

```
src/
  App.tsx                     app shell, sign-in, start screen vs call screen
  components/
    RoomSelection.tsx         create / join screen
    ConferenceRoom.tsx        call screen: video, controls, sidebar
    ChatPanel.tsx  FilePanel.tsx  WhiteboardPanel.tsx
    ui.tsx  Icons.tsx         buttons, tabs, toast, icons
  hooks/
    useRoom.ts                camera, Firestore signaling, peer connection, data channel
    useMediaControls.ts       mute, camera, screen share
    useAuth.ts  useToast.ts
  lib/
    firebase.ts  rtc.ts       config and WebRTC settings
    messages.ts  transfer.ts  message validation, chunked file transfer
firestore.rules               security rules to publish
```

## What changed from `collabmeet_pro.tsx`

Bugs fixed:

- **Whiteboard didn't work.** The canvas was sized while its tab was hidden, so it collapsed to 0x0 and
  stayed blank. It now resizes with a `ResizeObserver` and redraws from stored strokes. The remote
  "clear" also left a transparent board; it now repaints the background.
- **Lost connections.** ICE candidates from the other side could arrive before the remote description
  was set and were dropped. They are now queued until it is ready.
- **Large files killed the connection.** Sending had no backpressure. Chunks now pause while the send
  buffer is full, with a progress bar. Empty files and the data channel's binary type are handled.
- **Leaks and duplicates.** Firestore listeners were never unsubscribed, the camera could stay on after
  leaving, and React StrictMode could create two rooms. Setup and teardown are now cancel-safe, and
  the host's room is deleted when they leave.
- **Screen sharing** could crash on `sender.track.kind` when a track was null, and the shared screen was
  shown mirrored. Both fixed.
- **Joining a full or missing room** now says so (and doesn't turn the camera on first).
- Touch drawing fired both touch and mouse events; it now uses pointer events.
- "Peer left" is detected from the data channel and room deletion instead of a transient
  `disconnected` state.

Added:

- Standalone setup: your own Firebase config via `.env` instead of the preview-only globals, plus a
  setup screen when it's missing and a clear message when anonymous sign-in is off.
- Invite links (`?room=...`), unread badges on tabs, message times, file sizes.
- Strict TypeScript, incoming message validation, and tightened Firestore rules.
- Accessibility labels on controls, the missing CSS for `custom-scrollbar` and `animate-fade-in-up`,
  and removal of the external texture image the video placeholder loaded.
