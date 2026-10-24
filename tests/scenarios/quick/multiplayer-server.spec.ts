import { expect, test } from "@playwright/test";

type RoomResponse = {
  code: string;
  playerId: string;
  revision: number;
  state: { turn: number; players: Record<string, unknown> } | null;
};

test("live multiplayer server creates, joins, resolves, polls, and closes a room", async ({ request }) => {
  const create = await request.post("/api/multiplayer", {
    data: { type: "create", seed: "server-check", difficulty: "easy" },
  });
  expect(create.status()).toBe(201);
  const host = await create.json() as RoomResponse;

  const join = await request.post("/api/multiplayer", {
    data: { type: "join", code: host.code },
  });
  expect(join.status()).toBe(201);
  const guest = await join.json() as RoomResponse;

  const start = await request.post("/api/multiplayer", {
    data: { type: "start", code: host.code, playerId: host.playerId },
  });
  expect(start.ok()).toBe(true);
  expect((await start.json() as RoomResponse).state?.players[guest.playerId]).toBeTruthy();

  for (const playerId of [host.playerId, guest.playerId]) {
    const action = await request.post("/api/multiplayer", {
      data: { type: "action", code: host.code, playerId, turn: 0, action: { type: "SUPPORT" } },
    });
    expect(action.ok()).toBe(true);
  }

  for (const playerId of [host.playerId, guest.playerId]) {
    const poll = await request.get("/api/multiplayer", { params: { code: host.code, playerId } });
    expect(poll.ok()).toBe(true);
    expect((await poll.json() as RoomResponse).state?.turn).toBe(1);
  }

  const leave = await request.post("/api/multiplayer", {
    data: { type: "leave", code: host.code, playerId: host.playerId },
  });
  expect(leave.ok()).toBe(true);
  const closedRoom = await request.get("/api/multiplayer", {
    params: { code: host.code, playerId: guest.playerId },
  });
  expect(closedRoom.status()).toBe(404);
});
