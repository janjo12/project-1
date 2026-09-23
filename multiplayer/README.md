# Manual WebRTC multiplayer

This module is a networking foundation. The current single-player screens do not import it yet. One playing device hosts the state; no dedicated game device or signaling service is needed.

## Usage flow

1. Host creates `createHostSession({ hostPlayerId, initialState, resolveTurn, onState })`.
2. For each guest, `await session.addPlayer(playerId)` returns offer text to share as QR data or copyable text. Each guest needs a separate offer.
3. Guest calls `await createClientConnection(offerText, { onOpen, onMessage, onError })`, then shares its `answerText` back.
4. Host calls `await session.acceptAnswer(playerId, answerText)` for that guest. Channel opening is asynchronous after signaling.
5. Once every channel opens, `session.start()` sends `INITIAL_STATE` and fixes the participant roster.
6. Guest calls `client.send({ type: "SUBMIT_ACTION", turn, action })`. Host calls `session.submitHostAction(turn, action)`.
7. When all participants submit, the host calls your synchronous `resolveTurn(state, actions)`. Return a serializable state with an increased `turn`. Guests apply `TURN_RESULT` in `onMessage`.
8. Call `client.close()` / `session.close()` when leaving. A closed guest channel removes that participant. Use `removePlayer` for an abandoned or failed peer.

Only the first action per participant per turn is accepted. Peer connections supply identity; stale/future actions and unsolicited state packets cannot modify host state. Validate game-specific legality in the resolver and the actual state schema in guest callbacks.

For timed turns, the game owns the timer and calls `session.finishTurn()` on expiry. The resolver decides how missing actions behave. Reset/cancel that timer on every `onState` and when leaving. No automatic host migration is provided.

## Integration still needed

Add a host/join lobby with text or QR exchange, define serializable multiplayer state with per-player positions, and adapt the existing single-player logic into the host resolver. Full SDP can require multiple QR codes; QR rendering/scanning is not provided by this module.

The installed native WebRTC dependency requires a rebuilt development/production app, not Expo Go. Its config plugin is registered in `app.json`; TypeScript now checks the multiplayer folder.

Default STUN helps discover addresses; gameplay does not pass through it. Override `connectionOptions.configuration` on the host or `configuration` on the client to supply your own ICE servers, or `{ iceServers: [] }` for local discovery. Direct connectivity depends on firewalls/NAT; some networks require a TURN relay. This removes the dedicated game server requirement, but does not guarantee connectivity on every network without infrastructure.

Tests use mocked native transport. Real connectivity still needs verification with two devices running native builds.
