const BUILD_FAILURE = "Multiplayer is unavailable in this app build or on this device. Install the Android development build to enable WebRTC; singleplayer is still available.";
const NETWORK_FAILURE = "Couldn't connect to the other player. Check the connection and retry. Singleplayer is still available.";
const UNKNOWN_FAILURE = "Multiplayer couldn't start. Check the connection and device support, then retry. Singleplayer is still available.";

const actionableMessages = [
  "Paste the complete host invitation.",
  "This reply does not match the pending player.",
  "Connect at least one other device first.",
];

export function describeMultiplayerFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return UNKNOWN_FAILURE;

  if (actionableMessages.includes(message)) return message;
  if (/native module|react-native-webrtc|RTCPeerConnection|TurboModule|not implemented|unsupported|not supported|module not found/i.test(message)) {
    return BUILD_FAILURE;
  }
  if (/ICE|timed? out|connection|network|peer.*(closed|failed)|data channel|disconnected/i.test(message)) {
    return NETWORK_FAILURE;
  }
  return UNKNOWN_FAILURE;
}
