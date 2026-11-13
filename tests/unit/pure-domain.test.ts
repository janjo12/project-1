import { normalizeSettings, DEFAULT_GAME_SETTINGS } from "@/utils/game-settings";
import { parseNetworkMessage, parseSessionDescription, isValidPlayerAction, isValidTurn } from "@/multiplayer/connection-protocol";
import { isRunGameLoopEnabled } from "@/game/engine/game-loop-policy";
import { getTurnStatus } from "@/game/engine/run-game-status";
import { getSupportFeedback } from "@/game/engine/support-feedback";
import { getAdjacentRoomTransition } from "@/utils/room-transition";
import { getRoomDoorways, getRoomSceneActors } from "@/game/engine/run-game-scene";
import { getRunSnapshot } from "@/game/engine/run-game-snapshot";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { getCurrentRoom, revealRooms } from "@/game/dungeon/rooms";

describe("pure settings normalization", () => {
  it("uses defaults for invalid roots and validates each persisted field independently", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_GAME_SETTINGS);
    expect(normalizeSettings([])).toEqual(DEFAULT_GAME_SETTINGS);
    expect(normalizeSettings({ difficulty: "expert", seed: 5, handedness: "up", microgamesEnabled: false }))
      .toEqual({ ...DEFAULT_GAME_SETTINGS, microgamesEnabled: false });
  });

  it("preserves every valid persisted option", () => {
    const settings = { appearance: "dark", difficulty: "hard", seed: "testwizard", microgamesEnabled: false, vibrationEnabled: false, reducedMotion: true, handedness: "left" };
    expect(normalizeSettings(settings)).toEqual(settings);
  });
});

describe("pure connectivity protocol validation", () => {
  it("accepts valid turn numbers and rejects invalid numeric values", () => {
    expect([0, 1, Number.MAX_SAFE_INTEGER].every(isValidTurn)).toBe(true);
    expect([NaN, Infinity, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1].some(isValidTurn)).toBe(false);
  });

  it("validates the supported action schema", () => {
    expect(isValidPlayerAction({ type: "ATTACK", target: "wolf", charged: true, microgameScore: 90 })).toBe(true);
    expect(isValidPlayerAction({ type: "ATTACK", microgameScore: 101 })).toBe(false);
    expect(isValidPlayerAction({ type: "SUPPORT", charged: "yes" })).toBe(false);
    expect(isValidPlayerAction({ type: "CHEAT" })).toBe(false);
    expect(isValidPlayerAction(null)).toBe(false);
  });

  it("parses only matching signaling descriptions and well-formed messages", () => {
    expect(parseSessionDescription('{"type":"offer","sdp":"sdp"}', "offer")).toEqual({ type: "offer", sdp: "sdp" });
    expect(() => parseSessionDescription('{"type":"answer","sdp":"sdp"}', "offer")).toThrow(/offer/i);
    expect(() => parseSessionDescription('{"type":"offer","sdp":" "}', "offer")).toThrow(/nonempty/i);
    const options = { difficulty: "hard", handedness: "left", microgamesEnabled: false, reducedMotion: true };
    expect(parseNetworkMessage(JSON.stringify({ type: "PLAYER_OPTIONS", options }))).toMatchObject({ type: "PLAYER_OPTIONS", options });
    expect(parseNetworkMessage(JSON.stringify({ type: "PLAYER_READY", options }))).toMatchObject({ type: "PLAYER_READY", options });
    expect(() => parseNetworkMessage(JSON.stringify({ type: "PLAYER_READY", options: { ...options, difficulty: "nightmare" } }))).toThrow(/invalid game message/i);
    expect(() => parseNetworkMessage(JSON.stringify({ type: "TURN_RESULT", turn: 3, state: { turn: 2 } }))).toThrow(/invalid game message/i);
    expect(() => parseNetworkMessage("not-json")).toThrow(SyntaxError);
  });
});

describe("small pure gameplay policies", () => {
  it("pauses the loop for each blocking screen state", () => {
    expect(isRunGameLoopEnabled({ running: true })).toBe(true);
    for (const key of ["pauseMenuOpen", "itemMenuOpen", "equipmentMenuOpen", "mapOpen", "microgameActive", "classIntroOpen"] as const) {
      expect(isRunGameLoopEnabled({ running: true, [key]: true })).toBe(false);
    }
    expect(isRunGameLoopEnabled({ running: false })).toBe(false);
  });

  it("keeps turn status precedence deterministic", () => {
    const args = { clearedLevels: 2, hasRoomEnemy: true, hasLost: true, isResolving: true, level: 3, roomId: "B4" };
    expect(getTurnStatus(args)).toBe("You fell!");
    expect(getTurnStatus({ ...args, hasLost: false })).toBe("Resolving turn...");
    expect(getTurnStatus({ ...args, hasLost: false, isResolving: false })).toBe("Combat | Level 3 | Room B4");
    expect(getTurnStatus({ ...args, hasLost: false, isResolving: false, hasRoomEnemy: false })).toBe("Room B4 clear | Level 3 | Cleared 2");
  });

  it("maps each class to its support label and icon", () => {
    expect(["warrior", "cleric", "thief", "archer", "wizard", "ghost"].map(id => getSupportFeedback(id as never).label))
      .toEqual(["Vanguard", "Aid", "Enrich", "Raise Focus", "Empower Attacks", "Haunt"]);
  });

  it("slides only for adjacent valid room transitions", () => {
    expect(getAdjacentRoomTransition("B5", "B6")).toBe("right");
    expect(getAdjacentRoomTransition("B5", "B4")).toBe("left");
    expect(getAdjacentRoomTransition("B5", "C5")).toBe("down");
    expect(getAdjacentRoomTransition("B5", "A5")).toBe("up");
    expect(getAdjacentRoomTransition("B5", "B7")).toBeNull();
    expect(getAdjacentRoomTransition(undefined, "B5")).toBeNull();
  });
});

describe("pure scene and snapshot derivation", () => {
  it("maps current-room boundaries and builds actors from room contents", () => {
    const map = createSeededDungeonMap("test", 1);
    const room = getCurrentRoom(map);
    expect(getRoomDoorways(room)).toEqual({ bottom: room.south, left: room.west, right: room.east, top: room.north });
    const actors = getRoomSceneActors({ currentMonsterId: null, dungeonMap: map, room });
    expect(Array.isArray(actors)).toBe(true);
    expect(actors.every(actor => typeof actor.id === "string" && typeof actor.position === "string")).toBe(true);
  });

  it("derives loss, timer, item, and spyglass visibility from state", () => {
    const map = createSeededDungeonMap("test", 1, undefined, true);
    const roomId = map.startingRoomId;
    const snapshot = getRunSnapshot({
      activeMonsterId: null, clearedLevels: 0, difficulty: "hard", dungeonMap: map, inventoryItem: "health-potion",
      equipment: "spyglass", isResolving: false, level: 2, playerEnergy: 5, playerHealth: 0, turnCounter: 0,
    });
    expect(snapshot).toMatchObject({ currentRoomId: roomId, hasLost: true, hasTurnTimer: true, showUseItemNow: true, canUseItemNow: true });
    expect(snapshot.visibleDungeonMap).not.toBe(map);
    expect(snapshot.turnStatus).toBe("You fell!");
    expect(revealRooms(map, roomId, true).rooms.flat().filter(room => room.isRevealed).length)
      .toBeGreaterThan(map.rooms.flat().filter(room => room.isRevealed).length);
  });
});
