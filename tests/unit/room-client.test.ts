import { isRoomConnectionFailure, pollRoom, requestRoom } from "@/multiplayer/room-client";

describe("browser multiplayer room requests", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; jest.restoreAllMocks(); });

  it("sends JSON room commands and returns a successful response", async () => {
    const fetchMock = jest.fn(async () => Response.json({ code: "ABC123" }, { status: 201 }));
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(requestRoom<{ code: string }>({ type: "create" })).resolves.toEqual({ code: "ABC123" });
    expect(fetchMock).toHaveBeenCalledWith("/api/multiplayer", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" }, body: '{"type":"create"}' }));
  });

  it.each([
    [400, "Bad room request"],
    [404, "Room has expired"],
    [503, "Capacity reached"],
  ])("preserves HTTP %i errors and classifies connectivity", async (status, message) => {
    globalThis.fetch = jest.fn(async () => Response.json({ error: message }, { status })) as typeof fetch;
    await expect(requestRoom({ type: "join" })).rejects.toMatchObject({ message, status });
    expect(isRoomConnectionFailure(Object.assign(new Error(message), { status }))).toBe(status === 404 || status >= 500);
  });

  it("surfaces malformed server JSON and fetch/network failures", async () => {
    globalThis.fetch = jest.fn(async () => new Response("not json", { status: 502 })) as typeof fetch;
    await expect(requestRoom({ type: "create" })).rejects.toThrow(/invalid JSON/i);
    expect(isRoomConnectionFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRoomConnectionFailure(new Error("invalid options"))).toBe(false);
  });

  it("polls with no-store and exposes expired-room errors for disconnect handling", async () => {
    const fetchMock = jest.fn(async () => Response.json({ error: "That room is closed." }, { status: 404 }));
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(pollRoom("ABC123", "player-2")).rejects.toMatchObject({ message: "That room is closed.", status: 404 });
    expect(fetchMock).toHaveBeenCalledWith("/api/multiplayer?code=ABC123&playerId=player-2", { cache: "no-store" });
  });
});
