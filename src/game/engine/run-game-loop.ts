import type {
  GameEngineSystem,
  GameEngineUpdateEventOptionType,
} from "react-native-game-engine";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

type GameLoopEntity = {
  elapsed: number;
  expired: boolean;
  isTurnClockActive: () => boolean;
  onExpire: () => void;
  onFrame: (delta: number, turnTimeRemaining?: number) => void;
  turnNumber: number;
  turnDuration: number;
};

type GameLoopEntities = {
  gameLoop: GameLoopEntity;
};

export class GameLoopTimer {
  private currentTime = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private subscribers = new Set<(time: number) => void>();

  start() {
    // Starting twice is a no-op so a mounted screen cannot accidentally create duplicate clocks.
    if (this.intervalId !== null) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.currentTime += GAME_PARAMETERS.turn.gameLoopTickMs;
      this.subscribers.forEach((subscriber) => subscriber(this.currentTime));
    }, GAME_PARAMETERS.turn.gameLoopTickMs);
  }

  stop() {
    if (this.intervalId === null) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  subscribe(callback: (time: number) => void) {
    this.subscribers.add(callback);
  }

  unsubscribe(callback: (time: number) => void) {
    this.subscribers.delete(callback);
  }
}

export const runGameLoop: GameEngineSystem = (
  entities: GameLoopEntities,
  { time }: GameEngineUpdateEventOptionType,
) => {
  // Advance animation and the active turn timer from frame deltas, then expire at most once per turn.
  const loop = entities.gameLoop;

  if (!loop) {
    return entities;
  }

  const delta = Math.max(0, time.delta || GAME_PARAMETERS.turn.gameLoopTickMs);
  const turnDuration = Math.max(1, loop.turnDuration);
  let turnTimeRemaining: number | undefined;
  let didExpire = false;

  if (loop.isTurnClockActive() && !loop.expired) {
    loop.elapsed = Math.min(turnDuration, loop.elapsed + delta);
    turnTimeRemaining = turnDuration - loop.elapsed;

    if (loop.elapsed >= turnDuration) {
      loop.expired = true;
      didExpire = true;
      turnTimeRemaining = 0;
    }
  }

  loop.onFrame(delta, turnTimeRemaining);

  if (didExpire) {
    loop.onExpire();
  }

  return entities;
};
