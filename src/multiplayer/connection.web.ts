import { isValidPlayerAction, isValidTurn, parseNetworkMessage, parseSessionDescription } from "@/multiplayer/connection-protocol";
import type { GameState, NetworkMessage, PlayerAction } from "@/multiplayer/connection-protocol";
import { isMultiplayerPlayerOptions, type MultiplayerPlayerOptions } from "@/multiplayer/player-options";
export type { GameState, NetworkMessage, PlayerAction } from "@/multiplayer/connection-protocol";

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
type StateWithPlayers = GameState & { players: Record<string, { [key: string]: unknown; gameplayOptions?: MultiplayerPlayerOptions }> };

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
  // Copy/paste signaling needs candidates embedded in the offer/answer before either can be shared.
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

function parseDescription(text: string, type: "offer" | "answer") {
  return new RTCSessionDescription(parseSessionDescription(text, type));
}

export function parseMessage(data: string): NetworkMessage {
  return parseNetworkMessage(data);
}

export function sendMessage(channel: GameChannel, message: NetworkMessage) {
  if (channel.readyState !== "open") throw new Error("Game channel is not open.");
  channel.send(JSON.stringify(message));
}
function bindChannel(channel: GameChannel, options: ConnectionOptions) {
  // Centralize transport events so parse failures reach the caller without crashing the channel loop.
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
  // The host creates the ordered game channel and shares a fully gathered offer with the guest.
  const pc = createPeerConnection(options.configuration);
  const channel = pc.createDataChannel("game", { ordered: true });
  peerEvents(pc).addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed") { channel.close(); pc.close(); options.onError?.(new Error("Player connection failed.")); }
  });
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
  // A guest applies the invitation, gathers its answer, then waits for the host-created channel.
  const offer = parseDescription(offerText, "offer");
  const pc = createPeerConnection(options.configuration);
  let channel: GameChannel | undefined;
  peerEvents(pc).addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed") { channel?.close(); pc.close(); options.onError?.(new Error("Host connection failed.")); }
  });
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
  onPlayersChange?: () => void;
  onReadinessChange?: (playerIds: string[]) => void;
  isActivePlayer?: (state: State, playerId: string) => boolean;
};

/** One host owns all peers and runs game rules. Call finishTurn from a game timer if desired. */
export function createHostSession<State extends GameState>(options: HostSessionOptions<State>) {
  // Only the host resolves turns; stable participant/action maps keep all peers on one authoritative state.
  const connections = new Map<string, PlayerConnection>();
  const pending = new Set<string>();
  const actions = new Map<string, PlayerAction>();
  const readyPlayers = new Set<string>();
  const playerOptions = new Map<string, MultiplayerPlayerOptions>();
  let participants = new Set<string>();
  let state = options.initialState;
  let started = false;
  let closed = false;
  if (!options.hostPlayerId || !isValidTurn(state.turn)) throw new Error("Invalid host or initial turn.");

  function broadcast(message: NetworkMessage) {
    // Closed channels are skipped independently so one broken peer does not block the others.
    for (const player of connections.values()) {
      if (player.channel.readyState !== "open") continue;
      try { sendMessage(player.channel, message); }
      catch (error) { options.onError?.(error instanceof Error ? error : new Error(String(error))); }
    }
  }
  function finishTurn() {
    // A turn commits atomically: resolve, validate advancement, clear submissions, then publish the result.
    if (!started || closed) throw new Error("Start an active session before resolving turns.");
    let next: State;
    try {
      next = options.resolveTurn(state, new Map(actions));
    } catch (error) {
      actions.clear();
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
    if (!isValidTurn(next.turn) || next.turn <= state.turn) throw new Error("The resolver must advance the turn.");
    state = next;
    actions.clear();
    participants = new Set([options.hostPlayerId, ...connections.keys()].filter(id => options.isActivePlayer?.(state, id) ?? true));
    broadcast({ type: "TURN_RESULT", turn: state.turn, state });
    options.onState?.(state);
  }
  function submit(playerId: string, turn: number, action: PlayerAction) {
    // One current-turn action per active participant prevents stale, duplicate, or unauthorized submissions.
    if (!started || closed || !participants.has(playerId) || turn !== state.turn ||
        actions.has(playerId) || !isValidPlayerAction(action)) return false;
    actions.set(playerId, { ...action });
    if (actions.size === participants.size) {
      try { finishTurn(); }
      catch { return true; }
    }
    return true;
  }
  function removePlayer(playerId: string) {
    const player = connections.get(playerId);
    if (!player) return;
    connections.delete(playerId);
    readyPlayers.delete(playerId);
    playerOptions.delete(playerId);
    participants.delete(playerId);
    actions.delete(playerId);
    player?.close();
    options.onPlayersChange?.();
    options.onReadinessChange?.([...readyPlayers]);
    if (started && !closed && participants.size > 0 && actions.size === participants.size) finishTurn();
  }
  return {
    get state() { return state; },
    get playerIds() { return [...connections.keys()]; },
    get readyPlayerIds() { return [...connections.values()].filter(p => p.channel.readyState === "open").map(p => p.id); },
    get preparedPlayerIds() { return [...readyPlayers]; },
    async addPlayer(playerId: string) {
      // Reserve IDs during asynchronous offer creation so concurrent invites cannot collide.
      if (closed || started) throw new Error("Players can only join an open lobby.");
      if (!playerId || playerId === options.hostPlayerId || connections.has(playerId) || pending.has(playerId)) {
        throw new Error("Player ID must be unique.");
      }
      pending.add(playerId);
      try {
        const connection = await createHostConnection({
          ...options.connectionOptions,
          onError: options.onError,
          onOpen: () => options.onPlayersChange?.(),
          onMessage: (message) => {
            // Identity comes from this peer, never an ID supplied in a packet.
            if (message.type === "SUBMIT_ACTION") submit(playerId, message.turn, message.action);
            if ((message.type === "PLAYER_OPTIONS" || message.type === "PLAYER_READY") && isMultiplayerPlayerOptions(message.options)) {
              playerOptions.set(playerId, message.options);
              if (message.type === "PLAYER_OPTIONS") readyPlayers.delete(playerId);
              else readyPlayers.add(playerId);
              const current = state as unknown as StateWithPlayers;
              if (current.players?.[playerId]) {
                state = { ...current, players: { ...current.players, [playerId]: { ...current.players[playerId], gameplayOptions: message.options } } } as unknown as State;
              }
              options.onReadinessChange?.([...readyPlayers]);
            }
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
    start(initialState?: State) {
      // Starting freezes the roster; every connected peer receives the same initial snapshot.
      if (closed || started || pending.size || [...connections.values()].some(p => p.channel.readyState !== "open")) {
        throw new Error("Wait for every player channel to open before starting.");
      }
      if ([...connections.keys()].some(id => !readyPlayers.has(id))) throw new Error("Wait for every player to choose their options and press Start.");
      participants = new Set([options.hostPlayerId, ...connections.keys()]);
      if (initialState) {
        const next = initialState as unknown as StateWithPlayers;
        const players = { ...next.players };
        for (const [id, nextOptions] of playerOptions) {
          if (players[id]) players[id] = { ...players[id], gameplayOptions: nextOptions };
        }
        state = { ...next, players } as unknown as State;
      }
      started = true;
      broadcast({ type: "INITIAL_STATE", turn: state.turn, state });
      options.onState?.(state);
    },
    submitHostAction: (turn: number, action: PlayerAction) => submit(options.hostPlayerId, turn, action),
    setPlayerOptions(playerId: string, nextOptions: MultiplayerPlayerOptions) {
      playerOptions.set(playerId, nextOptions);
      readyPlayers.delete(playerId);
      options.onReadinessChange?.([...readyPlayers]);
      const current = state as unknown as StateWithPlayers;
      if (!current.players?.[playerId]) return false;
      state = { ...current, players: { ...current.players, [playerId]: { ...current.players[playerId], gameplayOptions: nextOptions } } } as unknown as State;
      broadcast({ type: "TURN_RESULT", turn: state.turn, state });
      options.onState?.(state);
      return true;
    },
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
