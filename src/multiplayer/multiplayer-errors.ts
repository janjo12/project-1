const BUILD_FAILURE = "Multiplayer isn't available on this device right now. You can still play solo.";
const NETWORK_FAILURE = "Couldn't connect to the other player. Check your connection and try again.";
const UNKNOWN_FAILURE = "Multiplayer ran into a problem. Please try again. You can still play solo.";

const actionableMessages = [
  "Paste the complete host invitation.",
  "This reply does not match the pending player.",
  "Connect at least one other device first.",
];

export function describeMultiplayerFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return UNKNOWN_FAILURE;

  if (actionableMessages.includes(message)) return message;
  if (/room code was not found|room code.*(invalid|incorrect)|couldn't find that room/i.test(message)) {
    return "We couldn't find that room. Check the code and try again.";
  }
  if (/room is closed|room.*closed|player has left|player is no longer in the room/i.test(message)) {
    return "This room is no longer available. Ask the host to create a new room.";
  }
  if (/room is full|room at capacity/i.test(message)) return "This room is full. Ask the host to try again later.";
  if (/already submitted|already.*action/i.test(message)) return "Your move is already in. Wait for the round to finish.";
  if (/already started|options are locked/i.test(message)) return "This game has already started. Ask the host to create a new room.";
  if (/wait for every player.*(options|press Start)|every player.*ready/i.test(message)) {
    return "Ask everyone to finish choosing their options and press Start.";
  }
  if (/only the host/i.test(message)) return "Only the host can change the shared game options or start the game.";
  if (/invalid or belongs to an earlier turn|earlier turn|out of date/i.test(message)) {
    return "That move is out of date. Please try again.";
  }
  if (/ghosts can only move/i.test(message)) return "As a ghost, you can move, attack, or support an ally.";
  if (/cannot act during the current phase|not accepting actions/i.test(message)) return "You can't take that action right now.";
  if (/choose valid|choose a valid/i.test(message)) return "Check your choices and try again.";
  if (/send a valid json|invalid multiplayer request|unknown multiplayer request/i.test(message)) {
    return "We couldn't complete that request. Please try again.";
  }
  if (/capacity|try again shortly/i.test(message)) return "Rooms are busy right now. Please try again shortly.";
  if (/wait for every player channel|channel.*not open|host channel has not arrived/i.test(message)) {
    return "Wait for everyone to connect, then try again.";
  }
  if (/connect at least one other device/i.test(message)) return "Invite another player before starting.";
  if (/native module|react-native-webrtc|RTCPeerConnection|TurboModule|not implemented|unsupported|not supported|module not found/i.test(message)) {
    return BUILD_FAILURE;
  }
  if (/ICE|timed? out|connection|network|peer.*(closed|failed)|data channel|disconnected/i.test(message)) {
    return NETWORK_FAILURE;
  }
  return UNKNOWN_FAILURE;
}

export function describeRoomOperationFailure(error: unknown, operation: string): string {
  const detail = describeMultiplayerFailure(error);
  if (detail !== UNKNOWN_FAILURE) return detail;
  if (operation === "join_room") return "Couldn't join that room. Check the room code and try again.";
  if (operation === "host_room") return "Couldn't create a room right now. Please try again.";
  if (operation === "start_room") return "Couldn't start the game. Check that everyone is ready and try again.";
  if (operation === "save_player_options") return "Couldn't save those options. Please try again.";
  if (operation === "submit_action") return "Couldn't send your move. Please try again.";
  if (operation === "poll") return "Connection to the room was interrupted. Try rejoining.";
  return detail;
}
