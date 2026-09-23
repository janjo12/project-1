import { RTCPeerConnection, RTCSessionDescription } from "react-native-webrtc";

export type GameChannel = ReturnType<RTCPeerConnection["createDataChannel"]>;
// v124's published declarations omit the vendored EventTarget base type.
// Describe only the native events used here instead of falling back to `any`.
type EventSource<Events> = {
  addEventListener<K extends keyof Events>(type: K, listener: (event: Events[K]) => void): void;
  removeEventListener<K extends keyof Events>(type: K, listener: (event: Events[K]) => void): void;
};
const peerEvents = (pc: RTCPeerConnection) => pc as unknown as EventSource<{
  icegatheringstatechange: unknown;
  connectionstatechange: unknown;
  datachannel: { channel: GameChannel };
}>;
const channelEvents = (channel: GameChannel) => channel as unknown as EventSource<{
  open: unknown; close: unknown; error: unknown; message: { data: unknown };
}>;
type Configuration = NonNullable<ConstructorParameters<typeof RTCPeerConnection>[0]>;
export type GameState = { turn: number; [key: string]: unknown };
export type PlayerAction = { type: "MOVE" | "ATTACK" | "DEFEND"; target?: string };
export type NetworkMessage =
  | { type: "PLAYER_INFO"; playerId: string; name: string }
  | { type: "SUBMIT_ACTION"; turn: number; action: PlayerAction }
  | { type: "INITIAL_STATE" | "TURN_RESULT"; turn: number; state: GameState };

export type ConnectionOptions = {
  configuration?: Configuration;
  iceTimeoutMs?: number;
  onOpen?: (channel: GameChannel) => void;
  onMessage?: (message: NetworkMessage) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
};

// STUN discovers addresses; it does not host the game or exchange offers/answers.
const defaultConfiguration: Configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
export function createPeerConnection(configuration = defaultConfiguration) {
  return new RTCPeerConnection(configuration);
}

export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      peerEvents(pc).removeEventListener("icegatheringstatechange", check);
      peerEvents(pc).removeEventListener("connectionstatechange", check);
    };
    const check = () => {
      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        cleanup();
        reject(new Error("Peer closed or failed while gathering ICE candidates."));
      } else if (pc.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("ICE gathering timed out. Create a new offer and try again."));
    }, timeoutMs);
    peerEvents(pc).addEventListener("icegatheringstatechange", check);
    peerEvents(pc).addEventListener("connectionstatechange", check);
    check();
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validTurn(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function validAction(value: unknown): value is PlayerAction {
  return record(value) && ["MOVE", "ATTACK", "DEFEND"].includes(String(value.type)) &&
    (value.target === undefined || typeof value.target === "string");
}
function parseDescription(text: string, type: "offer" | "answer") {
  const value: unknown = JSON.parse(text);
  if (!record(value) || value.type !== type || typeof value.sdp !== "string" || !value.sdp.trim()) {
    throw new Error(`Expected a WebRTC ${type} with a nonempty SDP.`);
  }
  return new RTCSessionDescription({ type, sdp: value.sdp });
}

export function parseMessage(data: string): NetworkMessage {
  const value: unknown = JSON.parse(data);
  if (record(value)) {
    if (value.type === "PLAYER_INFO" && typeof value.playerId === "string" && typeof value.name === "string") {
      return value as NetworkMessage;
    }
    if (value.type === "SUBMIT_ACTION" && validTurn(value.turn) && validAction(value.action)) {
      return value as NetworkMessage;
    }
    if ((value.type === "INITIAL_STATE" || value.type === "TURN_RESULT") && validTurn(value.turn) &&
        record(value.state) && value.state.turn === value.turn) {
      return value as NetworkMessage;
    }
  }
  throw new Error("Invalid game message.");
}

export function sendMessage(channel: GameChannel, message: NetworkMessage) {
  if (channel.readyState !== "open") throw new Error("Game channel is not open.");
  channel.send(JSON.stringify(message));
}
function bindChannel(channel: GameChannel, options: ConnectionOptions) {
  channelEvents(channel).addEventListener("open", () => options.onOpen?.(channel));
  channelEvents(channel).addEventListener("close", () => options.onClose?.());
  channelEvents(channel).addEventListener("error", () => options.onError?.(new Error("Game channel failed.")));
  channelEvents(channel).addEventListener("message", (event) => {
    let message: NetworkMessage;
    try {
      if (typeof event.data !== "string") throw new Error("Expected a JSON text message.");
      message = parseMessage(event.data);
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    options.onMessage?.(message);
  });
}

export async function createHostConnection(options: ConnectionOptions = {}) {
  const pc = createPeerConnection(options.configuration);
  const channel = pc.createDataChannel("game", { ordered: true });
  bindChannel(channel, options);
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIceGathering(pc, options.iceTimeoutMs);
    if (!pc.localDescription) throw new Error("Missing local offer.");
    return {
      pc, channel, offer: pc.localDescription,
      offerText: JSON.stringify(pc.localDescription.toJSON()),
      close: () => { channel.close(); pc.close(); },
    };
  } catch (error) {
    channel.close();
    pc.close();
    throw error;
  }
}

export async function createClientConnection(offerText: string, options: ConnectionOptions = {}) {
  const offer = parseDescription(offerText, "offer");
  const pc = createPeerConnection(options.configuration);
  let channel: GameChannel | undefined;
  peerEvents(pc).addEventListener("datachannel", (event) => {
    if (channel || event.channel.label !== "game") { event.channel.close(); return; }
    channel = event.channel;
    bindChannel(event.channel, options);
  });
  try {
    await pc.setRemoteDescription(offer);
    await pc.setLocalDescription(await pc.createAnswer());
    await waitForIceGathering(pc, options.iceTimeoutMs);
    if (!pc.localDescription) throw new Error("Missing local answer.");
    return {
      pc, answer: pc.localDescription,
      answerText: JSON.stringify(pc.localDescription.toJSON()),
      get channel() { return channel; },
      send(message: NetworkMessage) {
        if (!channel) throw new Error("Host channel has not arrived yet.");
        sendMessage(channel, message);
      },
      close: () => { channel?.close(); pc.close(); },
    };
  } catch (error) {
    channel?.close();
    pc.close();
    throw error;
  }
}

export async function acceptAnswer(pc: RTCPeerConnection, answerText: string) {
  if (pc.signalingState !== "have-local-offer") throw new Error("This peer is not waiting for an answer.");
  await pc.setRemoteDescription(parseDescription(answerText, "answer"));
}

export type PlayerConnection = Awaited<ReturnType<typeof createHostConnection>> & { id: string };
export type HostSessionOptions<State extends GameState> = {
  hostPlayerId: string;
  initialState: State;
  resolveTurn: (state: State, actions: ReadonlyMap<string, PlayerAction>) => State;
  onState?: (state: State) => void;
  onError?: (error: Error) => void;
  connectionOptions?: Pick<ConnectionOptions, "configuration" | "iceTimeoutMs">;
};

/** One host owns all peers and runs game rules. Call finishTurn from a game timer if desired. */
export function createHostSession<State extends GameState>(options: HostSessionOptions<State>) {
  const connections = new Map<string, PlayerConnection>();
  const pending = new Set<string>();
  const actions = new Map<string, PlayerAction>();
  let participants = new Set<string>();
  let state = options.initialState;
  let started = false;
  let closed = false;
  if (!options.hostPlayerId || !validTurn(state.turn)) throw new Error("Invalid host or initial turn.");

  function broadcast(message: NetworkMessage) {
    for (const player of connections.values()) {
      if (player.channel.readyState !== "open") continue;
      try { sendMessage(player.channel, message); }
      catch (error) { options.onError?.(error instanceof Error ? error : new Error(String(error))); }
    }
  }
  function finishTurn() {
    if (!started || closed) throw new Error("Start an active session before resolving turns.");
    const next = options.resolveTurn(state, new Map(actions));
    if (!validTurn(next.turn) || next.turn <= state.turn) throw new Error("The resolver must advance the turn.");
    state = next;
    actions.clear();
    broadcast({ type: "TURN_RESULT", turn: state.turn, state });
    options.onState?.(state);
  }
  function submit(playerId: string, turn: number, action: PlayerAction) {
    if (!started || closed || !participants.has(playerId) || turn !== state.turn ||
        actions.has(playerId) || !validAction(action)) return false;
    actions.set(playerId, { ...action });
    if (actions.size === participants.size) finishTurn();
    return true;
  }
  function removePlayer(playerId: string) {
    const player = connections.get(playerId);
    if (!player) return;
    connections.delete(playerId);
    participants.delete(playerId);
    actions.delete(playerId);
    player?.close();
    if (started && !closed && actions.size === participants.size) finishTurn();
  }
  return {
    get state() { return state; },
    get playerIds() { return [...connections.keys()]; },
    async addPlayer(playerId: string) {
      if (closed || started) throw new Error("Players can only join an open lobby.");
      if (!playerId || playerId === options.hostPlayerId || connections.has(playerId) || pending.has(playerId)) {
        throw new Error("Player ID must be unique.");
      }
      pending.add(playerId);
      try {
        const connection = await createHostConnection({
          ...options.connectionOptions,
          onError: options.onError,
          onMessage: (message) => {
            // Identity comes from this peer, never an ID supplied in a packet.
            if (message.type === "SUBMIT_ACTION") submit(playerId, message.turn, message.action);
          },
          onClose: () => removePlayer(playerId),
        });
        if (closed) { connection.close(); throw new Error("Session closed during setup."); }
        connections.set(playerId, { ...connection, id: playerId });
        return connection.offerText;
      } finally { pending.delete(playerId); }
    },
    async acceptAnswer(playerId: string, answerText: string) {
      const player = connections.get(playerId);
      if (!player) throw new Error("No offer exists for this player.");
      await acceptAnswer(player.pc, answerText);
    },
    start() {
      if (closed || started || pending.size || [...connections.values()].some(p => p.channel.readyState !== "open")) {
        throw new Error("Wait for every player channel to open before starting.");
      }
      participants = new Set([options.hostPlayerId, ...connections.keys()]);
      started = true;
      broadcast({ type: "INITIAL_STATE", turn: state.turn, state });
      options.onState?.(state);
    },
    submitHostAction: (turn: number, action: PlayerAction) => submit(options.hostPlayerId, turn, action),
    finishTurn,
    removePlayer,
    close() {
      closed = true;
      for (const id of [...connections.keys()]) removePlayer(id);
      actions.clear();
      participants.clear();
    },
  };
}

