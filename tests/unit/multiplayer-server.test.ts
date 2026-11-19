import { GET, POST } from "../../app/api/multiplayer/route";
import type { MultiplayerState } from "@/game/engine/multiplayer-rules";

async function post(data: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/multiplayer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }));
}
async function rawPost(body: string) {
  return POST(new Request("http://localhost/api/multiplayer", { method: "POST", headers: { "Content-Type": "application/json" }, body }));
}

async function body<T>(response: Response) {
  return response.json() as Promise<T>;
}

type RoomResponse = {
  code: string;
  playerId: string;
  state: { turn: number; seed: string; difficulty: string; players: Record<string, { classId?: string; gameplayOptions?: { difficulty: string; handedness: string; microgamesEnabled: boolean; reducedMotion: boolean } }> } | null;
  playerOptions?: { difficulty: string; handedness: string; microgamesEnabled: boolean; reducedMotion: boolean };
  playerReady?: boolean;
  deadlineAt?: number | null;
  turnSubmitted?: boolean;
};

test.each([
  ["malformed JSON", "{"],
  ["missing request type", JSON.stringify({ code: "ABCD" })],
  ["invalid create parameters", JSON.stringify({ type: "create", seed: 12, difficulty: "expert" })],
] as const)("rejects %s with a client error", async (_label, raw) => {
  const response = await rawPost(raw);
  expect(response.status).toBe(400);
  expect((await body<{ error: string }>(response)).error).toBeTruthy();
});

test("room API rejects unknown rooms, unknown players, and unknown operations", async () => {
  expect((await GET(new Request("http://localhost/api/multiplayer?code=NOPE&playerId=host"))).status).toBe(404);
  const host = await body<RoomResponse>(await post({ type: "create", seed: "sad-path-check", difficulty: "easy" }));
  expect((await post({ type: "join", code: "NOPE" })).status).toBe(404);
  expect((await post({ type: "options", code: host.code, playerId: "intruder", handedness: "left" })).status).toBe(404);
  expect((await post({ type: "mystery", code: host.code, playerId: host.playerId })).status).toBe(400);
  await post({ type: "leave", code: host.code, playerId: host.playerId });
});

test("room API rejects unauthorized starts, invalid options, and duplicate or stale actions safely", async () => {
  const host = await body<RoomResponse>(await post({ type: "create", seed: "sad-path-actions", difficulty: "easy" }));
  const guest = await body<RoomResponse>(await post({ type: "join", code: host.code }));
  expect((await post({ type: "start", code: host.code, playerId: guest.playerId })).status).toBe(403);
  expect((await post({ type: "options", code: host.code, playerId: guest.playerId, handedness: "upside-down" })).status).toBe(400);
  expect((await post({ type: "options", code: host.code, playerId: guest.playerId, reducedMotion: "yes" })).status).toBe(400);
  expect((await post({ type: "start", code: host.code, playerId: host.playerId })).status).toBe(409);
  expect((await post({ type: "ready", code: host.code, playerId: guest.playerId, difficulty: "hard", handedness: "left", microgamesEnabled: false, reducedMotion: true })).ok).toBe(true);
  expect((await post({ type: "start", code: host.code, playerId: host.playerId })).ok).toBe(true);
  expect((await post({ type: "start", code: host.code, playerId: host.playerId })).status).toBe(409);
  expect((await post({ type: "action", code: host.code, playerId: host.playerId, turn: 4, action: { type: "SUPPORT" } })).status).toBe(400);
  expect((await post({ type: "action", code: host.code, playerId: host.playerId, turn: 0, action: { type: "CHEAT" } })).status).toBe(400);
  expect((await post({ type: "action", code: host.code, playerId: host.playerId, turn: 0, action: { type: "SUPPORT" } })).ok).toBe(true);
  expect((await post({ type: "action", code: host.code, playerId: host.playerId, turn: 0, action: { type: "SUPPORT" } })).status).toBe(409);
  expect((await post({ type: "action", code: host.code, playerId: guest.playerId, turn: 0, action: { type: "CLASS_READY" } })).ok).toBe(true);
  expect((await post({ type: "action", code: host.code, playerId: host.playerId, turn: 1, action: { type: "SUPPORT" } })).ok).toBe(true);
  await post({ type: "leave", code: host.code, playerId: host.playerId });
});

test("host can start with a bot that is ready, follows host settings, and acts automatically", async () => {
  const host = await body<RoomResponse>(await post({
    type: "create", seed: "bot-room", difficulty: "easy",
    handedness: "right", microgamesEnabled: true, reducedMotion: false,
  }));
  const added = await body<{ players: { id: string; ready: boolean }[] }>(await post({ type: "add-bot", code: host.code, playerId: host.playerId }));
  expect(added.players).toContainEqual({ id: "bot-1", health: 100, ready: true });

  await post({ type: "configure", code: host.code, playerId: host.playerId, difficulty: "normal", handedness: "left", microgamesEnabled: true, reducedMotion: true });
  const started = await body<{ state: MultiplayerState | null }>(await post({ type: "start", code: host.code, playerId: host.playerId }));
  expect(started.state?.players["bot-1"].gameplayOptions).toEqual({
    difficulty: "normal", handedness: "left", microgamesEnabled: false, reducedMotion: true,
  });

  const briefing = await body<{ state: MultiplayerState | null }>(await post({
    type: "action", code: host.code, playerId: host.playerId, turn: 0, action: { type: "CLASS_READY" },
  }));
  expect(briefing.state).toMatchObject({ phase: "playing", turn: 1 });
  expect((await post({ type: "action", code: host.code, playerId: "bot-1", turn: 1, action: { type: "SUPPORT" } })).status).toBe(403);

  const state = briefing.state!;
  const hostRoom = state.map.rooms.flat().find(room => room.id === state.players.host.roomId)!;
  const direction = (["north", "east", "south", "west"] as const).find(value => hostRoom[value] === "open");
  expect(direction).toBeDefined();
  const moved = await body<{ state: MultiplayerState | null }>(await post({
    type: "action", code: host.code, playerId: host.playerId, turn: 1, action: { type: "MOVE", target: direction },
  }));
  expect(moved.state?.turn).toBe(2);
  expect(moved.state?.players["bot-1"].roomId).toBe(moved.state?.players.host.roomId);
  await post({ type: "leave", code: host.code, playerId: host.playerId });
});

test("each room member can configure independent gameplay options", async () => {
  const host = await body<RoomResponse>(await post({ type: "create", seed: "option-check", difficulty: "easy" }));
  const guest = await body<RoomResponse>(await post({ type: "join", code: host.code }));
  await post({ type: "options", code: host.code, playerId: host.playerId, difficulty: "normal", handedness: "left", microgamesEnabled: false, reducedMotion: true });
  await post({ type: "options", code: host.code, playerId: guest.playerId, difficulty: "hard", handedness: "right", microgamesEnabled: true, reducedMotion: false });
  const hostPoll = await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${host.playerId}`));
  const guestPoll = await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${guest.playerId}`));
  expect((await body<RoomResponse>(hostPoll)).playerOptions).toEqual({ difficulty: "normal", handedness: "left", microgamesEnabled: false, reducedMotion: true });
  expect((await body<RoomResponse>(guestPoll)).playerOptions).toEqual({ difficulty: "hard", handedness: "right", microgamesEnabled: true, reducedMotion: false });
  await post({ type: "leave", code: host.code, playerId: host.playerId });
});

test.each([
  ["testwizard", "wizard"],
  ["testcleric", "cleric"],
  ["testthief", "thief"],
])("host can set shared seed %s after joining and all players receive the dedicated class", async (seed, expectedClass) => {
  const host = await body<RoomResponse>(await post({ type: "create", seed: "initial-random-seed", difficulty: "easy" }));
  const guest = await body<RoomResponse>(await post({ type: "join", code: host.code }));
  expect((await post({ type: "configure", code: host.code, playerId: host.playerId, seed, difficulty: "normal" })).ok).toBe(true);
  expect((await post({ type: "configure", code: host.code, playerId: guest.playerId, seed: "testwizard" })).status).toBe(403);
  expect((await post({ type: "ready", code: host.code, playerId: guest.playerId, difficulty: "hard" })).ok).toBe(true);
  const start = await body<RoomResponse>(await post({ type: "start", code: host.code, playerId: host.playerId }));
  expect(start.state).toMatchObject({ seed, difficulty: "normal" });
  expect(Object.values(start.state!.players).map(player => player.classId)).toEqual([expectedClass, expectedClass]);
  expect(start.state!.players.host.gameplayOptions?.difficulty).toBe("normal");
  expect(start.state!.players[guest.playerId].gameplayOptions?.difficulty).toBe("hard");
  await post({ type: "leave", code: host.code, playerId: host.playerId });
  expect(guest.playerId).toBe("player-2");
});

test("configure rejects invalid shared settings without starting or changing the room", async () => {
  const host = await body<RoomResponse>(await post({ type: "create", seed: "keep-this-seed", difficulty: "easy" }));
  const invalidSeed = await post({ type: "configure", code: host.code, playerId: host.playerId, seed: 42 });
  const invalidDifficulty = await post({ type: "configure", code: host.code, playerId: host.playerId, difficulty: "extreme" });
  expect(invalidSeed.status).toBe(400);
  expect(invalidDifficulty.status).toBe(400);
  const joined = await body<RoomResponse>(await post({ type: "join", code: host.code }));
  await post({ type: "ready", code: host.code, playerId: joined.playerId });
  const started = await body<RoomResponse>(await post({ type: "start", code: host.code, playerId: host.playerId }));
  expect(started.state?.seed).toBe("keep-this-seed");
  await post({ type: "leave", code: host.code, playerId: joined.playerId });
  await post({ type: "leave", code: host.code, playerId: host.playerId });
});

test("Hard action timeout passes only the Hard host while an Easy guest keeps their turn", async () => {
  jest.useFakeTimers();
  try {
    const host = await body<RoomResponse>(await post({ type: "create", seed: "timer-check", difficulty: "hard" }));
    const guest = await body<RoomResponse>(await post({ type: "join", code: host.code }));
    await post({ type: "ready", code: host.code, playerId: guest.playerId });
    await post({ type: "start", code: host.code, playerId: host.playerId });
    for (const playerId of [host.playerId, guest.playerId]) await post({ type: "action", code: host.code, playerId, turn: 0, action: { type: "CLASS_READY" } });
    const before = await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${host.playerId}`));
    const beforeData = await body<RoomResponse>(before);
    expect(beforeData.deadlineAt).not.toBeNull();
    expect(beforeData.deadlineAt! - Date.now()).toBe(5_000);
    expect(beforeData.state).toMatchObject({ difficulty: "normal" });
    expect(beforeData.state?.players.host.gameplayOptions?.difficulty).toBe("hard");
    expect(beforeData.state?.players[guest.playerId].gameplayOptions?.difficulty).toBe("easy");
    const easyView = await body<RoomResponse>(await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${guest.playerId}`)));
    expect(easyView.deadlineAt).toBeNull();
    expect(easyView.turnSubmitted).toBe(false);
    jest.advanceTimersByTime(20_000);
    const afterHostTimeout = await body<RoomResponse>(await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${host.playerId}`)));
    expect(afterHostTimeout.state?.turn).toBe(beforeData.state?.turn);
    expect(afterHostTimeout.turnSubmitted).toBe(true);
    expect(afterHostTimeout.deadlineAt).toBeNull();
    const afterGuestAction = await body<RoomResponse>(await post({
      type: "action", code: host.code, playerId: guest.playerId,
      turn: beforeData.state!.turn, action: { type: "SUPPORT" },
    }));
    expect(afterGuestAction.state?.turn).toBe(beforeData.state!.turn + 1);
    expect(afterGuestAction.state?.players.host.gameplayOptions?.difficulty).toBe("hard");
    expect(afterGuestAction.state?.players[guest.playerId].gameplayOptions?.difficulty).toBe("easy");
    await post({ type: "leave", code: host.code, playerId: host.playerId });
  } finally { jest.useRealTimers(); }
});

test("a Hard guest gets a personal action deadline while an Easy host does not", async () => {
  jest.useFakeTimers();
  try {
    const host = await body<RoomResponse>(await post({ type: "create", seed: "guest-hard-timer", difficulty: "easy" }));
    const guest = await body<RoomResponse>(await post({ type: "join", code: host.code }));
    await post({
      type: "options", code: host.code, playerId: guest.playerId,
      difficulty: "hard", handedness: "right", microgamesEnabled: true, reducedMotion: false,
    });
    await post({ type: "ready", code: host.code, playerId: guest.playerId });
    await post({ type: "start", code: host.code, playerId: host.playerId });
    for (const playerId of [host.playerId, guest.playerId]) {
      await post({ type: "action", code: host.code, playerId, turn: 0, action: { type: "CLASS_READY" } });
    }

    const hostView = await body<RoomResponse>(await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${host.playerId}`)));
    const guestView = await body<RoomResponse>(await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${guest.playerId}`)));
    expect(hostView.deadlineAt).toBeNull();
    expect(guestView.deadlineAt).not.toBeNull();

    jest.advanceTimersByTime(5_000);
    const timedOutGuest = await body<RoomResponse>(await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${guest.playerId}`)));
    expect(timedOutGuest.turnSubmitted).toBe(true);
    expect(timedOutGuest.state?.turn).toBe(1);
    const hostAfterTimeout = await body<RoomResponse>(await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${host.playerId}`)));
    expect(hostAfterTimeout.turnSubmitted).toBe(false);

    const nextTurn = await body<RoomResponse>(await post({
      type: "action", code: host.code, playerId: host.playerId,
      turn: 1, action: { type: "SUPPORT" },
    }));
    expect(nextTurn.state?.turn).toBe(2);
    await post({ type: "leave", code: host.code, playerId: host.playerId });
  } finally { jest.useRealTimers(); }
});

test("real multiplayer API route creates, joins, resolves, polls, and closes a room", async () => {
  const create = await post({ type: "create", seed: "server-check", difficulty: "easy" });
  expect(create.status).toBe(201);
  const host = await body<RoomResponse>(create);

  const join = await post({ type: "join", code: host.code });
  expect(join.status).toBe(201);
  const guest = await body<RoomResponse>(join);

  await post({ type: "ready", code: host.code, playerId: guest.playerId });

  const start = await post({ type: "start", code: host.code, playerId: host.playerId });
  expect(start.ok).toBe(true);
  expect((await body<RoomResponse>(start)).state?.players[guest.playerId]).toBeTruthy();

  for (const playerId of [host.playerId, guest.playerId]) {
    const action = await post({ type: "action", code: host.code, playerId, turn: 0, action: { type: "CLASS_READY" } });
    expect(action.ok).toBe(true);
  }

  for (const playerId of [host.playerId, guest.playerId]) {
    const poll = await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${playerId}`));
    expect(poll.ok).toBe(true);
    expect((await body<RoomResponse>(poll)).state?.turn).toBe(1);
  }

  const leave = await post({ type: "leave", code: host.code, playerId: host.playerId });
  expect(leave.ok).toBe(true);
  const closedRoom = await GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${guest.playerId}`));
  expect(closedRoom.status).toBe(404);
});

test("lobby rejoins never reuse a player ID still present in the room", async () => {
  const host = await body<RoomResponse>(await post({ type: "create", seed: "rejoin-check", difficulty: "easy" }));
  const first = await body<RoomResponse>(await post({ type: "join", code: host.code }));
  const second = await body<RoomResponse>(await post({ type: "join", code: host.code }));

  const leave = await post({ type: "leave", code: host.code, playerId: first.playerId });
  expect(leave.ok).toBe(true);
  const replacement = await body<RoomResponse>(await post({ type: "join", code: host.code }));

  expect([host.playerId, second.playerId, replacement.playerId]).toEqual(["host", "player-3", "player-4"]);
  expect(new Set([host.playerId, second.playerId, replacement.playerId]).size).toBe(3);
  await post({ type: "leave", code: host.code, playerId: host.playerId });
});

test("rooms remain isolated during concurrent starts, turn submissions, and polls", async () => {
  const roomCount = 32;
  const rooms = await Promise.all(Array.from({ length: roomCount }, async (_, index) => {
    const host = await body<RoomResponse>(await post({ type: "create", seed: `room-load-${index}`, difficulty: "easy" }));
    const guests = await Promise.all(Array.from({ length: 2 }, async () =>
      body<RoomResponse>(await post({ type: "join", code: host.code })),
    ));
    await Promise.all(guests.map(guest => post({ type: "ready", code: host.code, playerId: guest.playerId })));
    return { host, guests };
  }));

  try {
    expect(new Set(rooms.map(({ host }) => host.code)).size).toBe(roomCount);
    const starts = await Promise.all(rooms.map(({ host }) =>
      post({ type: "start", code: host.code, playerId: host.playerId }),
    ));
    expect(starts.every(response => response.ok)).toBe(true);

    const submissions = await Promise.all(rooms.flatMap(({ host, guests }) =>
      [host.playerId, ...guests.map(guest => guest.playerId)].map(playerId =>
        post({ type: "action", code: host.code, playerId, turn: 0, action: { type: "CLASS_READY" } }),
      ),
    ));
    expect(submissions.every(response => response.ok)).toBe(true);

    const polls = await Promise.all(rooms.flatMap(({ host, guests }) =>
      [host.playerId, ...guests.map(guest => guest.playerId)].map(playerId =>
        GET(new Request(`http://localhost/api/multiplayer?code=${host.code}&playerId=${playerId}`)),
      ),
    ));
    const snapshots = await Promise.all(polls.map(body<RoomResponse>));
    expect(snapshots.every(snapshot => snapshot.state?.turn === 1 && snapshot.state.players)).toBe(true);
    for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
      const { host, guests } = rooms[roomIndex];
      expect(Object.keys(snapshots[roomIndex * 3].state!.players).sort())
        .toEqual([host.playerId, ...guests.map(guest => guest.playerId)].sort());
    }
  } finally {
    await Promise.all(rooms.map(({ host }) => post({ type: "leave", code: host.code, playerId: host.playerId })));
  }
}, 30_000);

test("room player capacity rejects extra guests without changing the roster", async () => {
  const host = await body<RoomResponse>(await post({ type: "create", seed: "capacity-check", difficulty: "easy" }));
  const guests = await Promise.all(Array.from({ length: 7 }, () => post({ type: "join", code: host.code })));
  expect(guests.every(response => response.status === 201)).toBe(true);

  const full = await post({ type: "join", code: host.code });
  expect(full.status).toBe(409);
  await post({ type: "leave", code: host.code, playerId: host.playerId });
});
