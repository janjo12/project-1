import { describeMultiplayerFailure, describeRoomOperationFailure } from "@/multiplayer/multiplayer-errors";

describe("multiplayer failure guidance", () => {
  it("keeps singleplayer available when native WebRTC is missing", () => {
    expect(describeMultiplayerFailure(new Error("Cannot find native module react-native-webrtc"))).toMatch(/isn't available/i);
    expect(describeMultiplayerFailure(new Error("Cannot find native module react-native-webrtc"))).toMatch(/play solo/i);
    expect(describeMultiplayerFailure(new Error("WebRTC is not supported on this emulator"))).toMatch(/play solo/i);
  });

  it("gives general connection guidance for timeouts and failed peer connections", () => {
    const guidance = describeMultiplayerFailure(new Error("ICE gathering timed out"));
    expect(guidance).toMatch(/check your connection/i);
    expect(guidance).not.toMatch(/Wi-Fi/i);
    expect(guidance).not.toMatch(/ICE|WebRTC|error code/i);
  });

  it("preserves actionable invitation validation errors", () => {
    expect(describeMultiplayerFailure(new Error("Paste the complete host invitation."))).toBe("Paste the complete host invitation.");
  });

  it("handles non-Error failures without exposing raw runtime details", () => {
    expect(describeMultiplayerFailure("unexpected native failure")).toMatch(/multiplayer ran into a problem/i);
    expect(describeMultiplayerFailure("unexpected native failure")).toMatch(/play solo/i);
  });

  it("turns room-server responses into clear player guidance without exposing status codes", () => {
    const guidance = describeRoomOperationFailure(Object.assign(new Error("Multiplayer request failed (503)."), { status: 503 }), "join_room");
    expect(guidance).toBe("Couldn't join that room. Check the room code and try again.");
    expect(guidance).not.toMatch(/503|status|request failed/i);
    expect(describeMultiplayerFailure(Object.assign(new Error("That room code was not found. Check it and try again."), { status: 404 })))
      .toBe("We couldn't find that room. Check the code and try again.");
  });

  it("uses recovery guidance for common multiplayer actions", () => {
    expect(describeMultiplayerFailure(new Error("You already submitted an action for this turn.")))
      .toBe("Your move is already in. Wait for the round to finish.");
    expect(describeMultiplayerFailure(new Error("Wait for every player channel to open before starting.")))
      .toBe("Wait for everyone to connect, then try again.");
  });
});
