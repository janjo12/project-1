import { GET, POST } from "../../app/api/multiplayer/route";

async function post(data: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/multiplayer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }));
}

async function body<T>(response: Response) {
  return response.json() as Promise<T>;
}

type RoomResponse = {
  code: string;
  playerId: string;
  state: { turn: number; players: Record<string, unknown> } | null;
};

test("real multiplayer API route creates, joins, resolves, polls, and closes a room", async () => {
  const create = await post({ type: "create", seed: "server-check", difficulty: "easy" });
  expect(create.status).toBe(201);
  const host = await body<RoomResponse>(create);

  const join = await post({ type: "join", code: host.code });
  expect(join.status).toBe(201);
  const guest = await body<RoomResponse>(join);

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
