import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { GameLoopTimer, runGameLoop } from "@/game/engine/run-game-loop";

function fixture(overrides: Partial<{
  elapsed: number;
  expired: boolean;
  turnDuration: number;
  active: boolean;
}> = {}) {
  const calls = { expire: jest.fn(), frame: jest.fn() };
  const loop = {
    elapsed: overrides.elapsed ?? 0,
    expired: overrides.expired ?? false,
    turnDuration: overrides.turnDuration ?? 100,
    turnNumber: 1,
    isTurnClockActive: () => overrides.active ?? true,
    onExpire: calls.expire,
    onFrame: calls.frame,
  };
  return { calls, entities: { gameLoop: loop }, loop };
}

describe("runGameLoop", () => {
  it("returns the same entities when the game-loop entity is missing", () => {
    const entities = {} as never;
    expect(runGameLoop(entities, { time: { delta: 16 } } as never)).toBe(entities);
  });

  it("advances by frame delta and reports the remaining duration", () => {
    const { calls, entities, loop } = fixture();
    runGameLoop(entities as never, { time: { delta: 25 } } as never);
    expect(loop.elapsed).toBe(25);
    expect(calls.frame).toHaveBeenCalledWith(25, 75);
    expect(calls.expire).not.toHaveBeenCalled();
  });

  it("expires only once at the deadline and clamps elapsed", () => {
    const { calls, entities, loop } = fixture({ elapsed: 90 });
    runGameLoop(entities as never, { time: { delta: 50 } } as never);
    runGameLoop(entities as never, { time: { delta: 50 } } as never);
    expect(loop.elapsed).toBe(100);
    expect(calls.frame).toHaveBeenNthCalledWith(1, 50, 0);
    expect(calls.expire).toHaveBeenCalledTimes(1);
  });

  it("does not advance an inactive or already expired clock", () => {
    const inactive = fixture({ active: false });
    runGameLoop(inactive.entities as never, { time: { delta: 30 } } as never);
    expect(inactive.loop.elapsed).toBe(0);
    expect(inactive.calls.frame).toHaveBeenCalledWith(30, undefined);
    const expired = fixture({ expired: true });
    runGameLoop(expired.entities as never, { time: { delta: 30 } } as never);
    expect(expired.loop.elapsed).toBe(0);
    expect(expired.calls.expire).not.toHaveBeenCalled();
  });
});

describe("GameLoopTimer", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("starts idempotently, publishes ticks, supports unsubscribe, and stops", () => {
    const timer = new GameLoopTimer();
    const subscriber = jest.fn();
    timer.subscribe(subscriber);
    timer.start();
    timer.start();
    jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 2);
    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber).toHaveBeenLastCalledWith(GAME_PARAMETERS.turn.gameLoopTickMs * 2);
    timer.unsubscribe(subscriber);
    timer.stop();
    jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs);
    expect(subscriber).toHaveBeenCalledTimes(2);
  });
});
