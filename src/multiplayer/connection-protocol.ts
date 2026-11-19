import { isMultiplayerPlayerOptions, type MultiplayerPlayerOptions } from "@/multiplayer/player-options";

export type GameState = { turn: number; [key: string]: unknown };
export type PlayerAction = { type: "MOVE" | "ATTACK" | "SUPPORT" | "CLASS_READY" | "PICKUP" | "PICKUP_EQUIPMENT" | "DROP_EQUIPMENT" | "USE_ITEM" | "DESCEND" | "PASS"; target?: string; charged?: boolean; microgameScore?: number };
export type NetworkMessage =
  | { type: "PLAYER_INFO"; playerId: string; name: string }
  | { type: "SUBMIT_ACTION"; turn: number; action: PlayerAction }
  | { type: "PLAYER_OPTIONS"; options: MultiplayerPlayerOptions }
  | { type: "PLAYER_READY"; options: MultiplayerPlayerOptions }
  | { type: "INITIAL_STATE" | "TURN_RESULT"; turn: number; state: GameState };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidTurn(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isValidPlayerAction(value: unknown): value is PlayerAction {
  return isRecord(value) && ["MOVE", "ATTACK", "SUPPORT", "CLASS_READY", "PICKUP", "PICKUP_EQUIPMENT", "DROP_EQUIPMENT", "DESCEND", "PASS"].includes(String(value.type)) &&
    (value.charged === undefined || typeof value.charged === "boolean") &&
    (value.microgameScore === undefined || (typeof value.microgameScore === "number" && Number.isFinite(value.microgameScore) && value.microgameScore >= 0 && value.microgameScore <= 100)) &&
    (value.target === undefined || typeof value.target === "string");
}

export function parseSessionDescription(text: string, type: "offer" | "answer") {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || value.type !== type || typeof value.sdp !== "string" || !value.sdp.trim()) {
    throw new Error(`Expected a WebRTC ${type} with a nonempty SDP.`);
  }
  return { type, sdp: value.sdp } as const;
}

export function parseNetworkMessage(data: string): NetworkMessage {
  const value: unknown = JSON.parse(data);
  if (isRecord(value)) {
    if (value.type === "PLAYER_INFO" && typeof value.playerId === "string" && typeof value.name === "string") return value as NetworkMessage;
    if (value.type === "SUBMIT_ACTION" && isValidTurn(value.turn) && isValidPlayerAction(value.action)) return value as NetworkMessage;
    if ((value.type === "PLAYER_OPTIONS" || value.type === "PLAYER_READY") && isMultiplayerPlayerOptions(value.options)) return value as NetworkMessage;
    if ((value.type === "INITIAL_STATE" || value.type === "TURN_RESULT") && isValidTurn(value.turn) && isRecord(value.state) && value.state.turn === value.turn) return value as NetworkMessage;
  }
  throw new Error("Invalid game message.");
}
