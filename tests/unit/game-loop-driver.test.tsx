import { act, renderHook } from "@testing-library/react-native";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { useGameLoopDriver } from "@/game/engine/use-game-loop-driver";

describe("shared single-player loop driver", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("advances frames, expires once, and starts a fresh timer on the next turn", async () => {
    let frameCount = 0;
    let expirationCount = 0;
    const inputs = {
      enabled: true,
      isTurnClockActive: () => true,
      onExpire: () => { expirationCount += 1; },
      onFrame: () => { frameCount += 1; },
      turnDuration: GAME_PARAMETERS.turn.gameLoopTickMs * 2,
      levelNumber: 1,
      turnNumber: 1,
    };
    const { rerender } = await renderHook((props: typeof inputs) => useGameLoopDriver(props), { initialProps: inputs });

    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 3); });
    expect(frameCount).toBe(3);
    expect(expirationCount).toBe(1);

    await rerender({ ...inputs, turnNumber: 2 });
    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2); });
    expect(expirationCount).toBe(2);
  });

  it("pauses while the game UI is inactive and resumes the existing turn clock", async () => {
    let frameCount = 0;
    let expirationCount = 0;
    const input = {
      enabled: true,
      isTurnClockActive: () => true,
      onExpire: () => { expirationCount += 1; },
      onFrame: () => { frameCount += 1; },
      turnDuration: GAME_PARAMETERS.turn.gameLoopTickMs * 3,
      levelNumber: 1,
      turnNumber: 1,
    };
    const { rerender } = await renderHook((props: typeof input) => useGameLoopDriver(props), { initialProps: input });

    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs); });
    await rerender({ ...input, enabled: false });
    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 4); });
    expect(frameCount).toBe(1);
    expect(expirationCount).toBe(0);

    await rerender(input);
    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2); });
    expect(expirationCount).toBe(1);
  });

  it("resets the expired timer when the level changes without changing the turn or duration", async () => {
    let expirationCount = 0;
    const input = {
      enabled: true,
      isTurnClockActive: () => true,
      onExpire: () => { expirationCount += 1; },
      onFrame: () => undefined,
      turnDuration: GAME_PARAMETERS.turn.gameLoopTickMs * 2,
      levelNumber: 1,
      turnNumber: 1,
    };
    const { rerender } = await renderHook((props: typeof input) => useGameLoopDriver(props), { initialProps: input });

    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2); });
    expect(expirationCount).toBe(1);
    await rerender({ ...input, levelNumber: 2 });
    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2); });
    expect(expirationCount).toBe(2);
  });

  it("does not reset the timer when only the duration changes", async () => {
    let expirationCount = 0;
    const input = {
      enabled: true,
      isTurnClockActive: () => true,
      onExpire: () => { expirationCount += 1; },
      onFrame: () => undefined,
      turnDuration: GAME_PARAMETERS.turn.gameLoopTickMs * 4,
      levelNumber: 1,
      turnNumber: 1,
    };
    const { rerender } = await renderHook((props: typeof input) => useGameLoopDriver(props), { initialProps: input });

    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2); });
    await rerender({ ...input, turnDuration: GAME_PARAMETERS.turn.gameLoopTickMs * 3 });
    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs); });
    expect(expirationCount).toBe(1);

    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2); });
    await act(async () => { jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 4); });
    expect(expirationCount).toBe(1);
  });
});
