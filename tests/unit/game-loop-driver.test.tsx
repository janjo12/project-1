import { act, renderHook } from "@testing-library/react-native";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { useGameLoopDriver } from "@/game/engine/use-game-loop-driver";

describe("shared single-player loop driver", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("advances frames, expires once, and starts a fresh timer on the next turn", () => {
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
    const { rerender } = renderHook((props: typeof inputs) => useGameLoopDriver(props), { initialProps: inputs });

    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 3));
    expect(frameCount).toBe(3);
    expect(expirationCount).toBe(1);

    rerender({ ...inputs, turnNumber: 2 });
    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2));
    expect(expirationCount).toBe(2);
  });

  it("pauses while the game UI is inactive and resumes the existing turn clock", () => {
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
    const { rerender } = renderHook((props: typeof input) => useGameLoopDriver(props), { initialProps: input });

    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs));
    rerender({ ...input, enabled: false });
    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 4));
    expect(frameCount).toBe(1);
    expect(expirationCount).toBe(0);

    rerender(input);
    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2));
    expect(expirationCount).toBe(1);
  });

  it("resets the expired timer when the level changes without changing the turn or duration", () => {
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
    const { rerender } = renderHook((props: typeof input) => useGameLoopDriver(props), { initialProps: input });

    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2));
    expect(expirationCount).toBe(1);
    rerender({ ...input, levelNumber: 2 });
    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2));
    expect(expirationCount).toBe(2);
  });

  it("does not reset the timer when only the duration changes", () => {
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
    const { rerender } = renderHook((props: typeof input) => useGameLoopDriver(props), { initialProps: input });

    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2));
    rerender({ ...input, turnDuration: GAME_PARAMETERS.turn.gameLoopTickMs * 3 });
    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs));
    expect(expirationCount).toBe(1);

    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2));
    act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 4));
    expect(expirationCount).toBe(1);
  });
});
