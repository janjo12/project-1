import { describeMultiplayerFailure } from "@/multiplayer/multiplayer-errors";

describe("multiplayer failure guidance", () => {
  it("keeps singleplayer available when native WebRTC is missing", () => {
    expect(describeMultiplayerFailure(new Error("Cannot find native module react-native-webrtc"))).toMatch(/development build/i);
    expect(describeMultiplayerFailure(new Error("Cannot find native module react-native-webrtc"))).toMatch(/singleplayer/i);
    expect(describeMultiplayerFailure(new Error("WebRTC is not supported on this emulator"))).toMatch(/singleplayer/i);
  });

  it("gives local network troubleshooting for timeouts and failed peer connections", () => {
    const guidance = describeMultiplayerFailure(new Error("ICE gathering timed out"));
    expect(guidance).toMatch(/same Wi-Fi/i);
    expect(guidance).toMatch(/VPN|device isolation/i);
    expect(guidance).toMatch(/singleplayer/i);
  });

  it("preserves actionable invitation validation errors", () => {
    expect(describeMultiplayerFailure(new Error("Paste the complete host invitation."))).toBe("Paste the complete host invitation.");
  });

  it("handles non-Error failures without exposing raw runtime details", () => {
    expect(describeMultiplayerFailure("unexpected native failure")).toMatch(/multiplayer couldn't start/i);
    expect(describeMultiplayerFailure("unexpected native failure")).toMatch(/singleplayer/i);
  });
});
