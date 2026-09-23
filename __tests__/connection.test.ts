import { RTCPeerConnection } from "react-native-webrtc";
import { acceptAnswer, createClientConnection, createHostConnection, createHostSession, parseMessage, sendMessage, waitForIceGathering } from "../multiplayer/connection";

jest.mock("react-native-webrtc", () => {
  class Channel {
    label = "game";
    readyState = "connecting";
    listeners: Record<string, Function[]> = {};
    send = jest.fn();
    addEventListener(type: string, fn: Function) { (this.listeners[type] ??= []).push(fn); }
    emit(type: string, event = {}) { this.listeners[type]?.forEach(fn => fn(event)); }
    close() { this.readyState = "closed"; this.emit("close"); }
  }
  class Peer {
    static instances: Peer[] = [];
    iceGatheringState = "complete";
    connectionState = "new";
    signalingState = "stable";
    localDescription: any;
    channel = new Channel();
    listeners: Record<string, Function[]> = {};
    constructor() { Peer.instances.push(this); }
    addEventListener(type: string, fn: Function) { (this.listeners[type] ??= []).push(fn); }
    removeEventListener(type: string, fn: Function) { this.listeners[type] = this.listeners[type]?.filter(f => f !== fn); }
    createDataChannel() { return this.channel; }
    async createOffer() { return { type: "offer", sdp: "offer-with-candidates" }; }
    async createAnswer() { return { type: "answer", sdp: "answer-with-candidates" }; }
    async setLocalDescription(value: any) {
      this.localDescription = { ...value, toJSON: () => value };
      this.signalingState = value.type === "offer" ? "have-local-offer" : "stable";
    }
    setRemoteDescription = jest.fn(async () => { this.signalingState = "stable"; });
    close() { this.connectionState = "closed"; }
  }
  return { RTCPeerConnection: Peer, RTCSessionDescription: class { constructor(value: object) { Object.assign(this, value); } } };
});
const peers = () => (RTCPeerConnection as any).instances as any[];
beforeEach(() => { peers().length = 0; });

test("exports complete offer and answer text and applies the answer to its host peer", async () => {
  const host = await createHostConnection();
  const client = await createClientConnection(host.offerText);
  expect(JSON.parse(host.offerText)).toEqual({ type: "offer", sdp: "offer-with-candidates" });
  expect(JSON.parse(client.answerText).type).toBe("answer");
  await acceptAnswer(host.pc, client.answerText);
  expect(host.pc.setRemoteDescription).toHaveBeenCalledWith(expect.objectContaining({ type: "answer" }));
  await expect(acceptAnswer(host.pc, client.answerText)).rejects.toThrow("not waiting");
  expect(() => client.send({ type: "SUBMIT_ACTION", turn: 0, action: { type: "DEFEND" } })).toThrow("not arrived");
});

test("rejects malformed signaling and messages and sending before open", async () => {
  await expect(createClientConnection('{"type":"answer","sdp":"x"}')).rejects.toThrow("offer");
  expect(peers()).toHaveLength(0);
  expect(() => parseMessage('{"type":"SUBMIT_ACTION","turn":0,"action":{"type":"CHEAT"}}')).toThrow();
  const host = await createHostConnection();
  expect(() => sendMessage(host.channel, { type: "SUBMIT_ACTION", turn: 0, action: { type: "DEFEND" } })).toThrow("not open");
});

test("ICE completion waits and timeout removes listeners", async () => {
  jest.useFakeTimers();
  try {
    const pc = new RTCPeerConnection();
    pc.iceGatheringState = "gathering";
    const waiting = waitForIceGathering(pc, 100);
    const rejected = expect(waiting).rejects.toThrow("timed out");
    jest.advanceTimersByTime(100);
    await rejected;
    expect((pc as any).listeners.icegatheringstatechange).toEqual([]);
  } finally { jest.useRealTimers(); }
});

test("host collects one action per participant, rejects stale turns, and broadcasts authoritative state", async () => {
  const resolveTurn = jest.fn((state, actions) => ({ turn: state.turn + 1, count: actions.size }));
  const session = createHostSession({ hostPlayerId: "host", initialState: { turn: 0 }, resolveTurn });
  await session.addPlayer("p2");
  await session.addPlayer("p3");
  expect(() => session.start()).toThrow("Wait");
  peers().forEach(p => { p.channel.readyState = "open"; });
  session.start();
  const receive = (index: number, turn = 0) => peers()[index].channel.emit("message", {
    data: JSON.stringify({ type: "SUBMIT_ACTION", turn, action: { type: "DEFEND" } }),
  });
  receive(0, 99);
  receive(0);
  receive(0);
  expect(session.submitHostAction(0, { type: "DEFEND" })).toBe(true);
  expect(resolveTurn).not.toHaveBeenCalled();
  receive(1);
  expect(resolveTurn).toHaveBeenCalledTimes(1);
  expect(session.state.turn).toBe(1);
  expect(peers()[0].channel.send).toHaveBeenLastCalledWith(JSON.stringify({ type: "TURN_RESULT", turn: 1, state: { turn: 1, count: 3 } }));
  session.close();
  expect(peers().every(p => p.connectionState === "closed")).toBe(true);
});

test("explicit timeout can resolve missing actions and disconnect drops a participant", async () => {
  const resolver = jest.fn((state) => ({ turn: state.turn + 1 }));
  const session = createHostSession({ hostPlayerId: "host", initialState: { turn: 0 }, resolveTurn: resolver });
  await session.addPlayer("p2");
  peers()[0].channel.readyState = "open";
  session.start();
  session.finishTurn();
  session.submitHostAction(1, { type: "DEFEND" });
  session.removePlayer("p2");
  expect(resolver).toHaveBeenCalledTimes(2);
  session.close();
});
