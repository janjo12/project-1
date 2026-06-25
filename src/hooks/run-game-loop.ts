import type {
  GameEngineSystem,
  GameEngineUpdateEventOptionType,
} from "react-native-game-engine";

const GAME_LOOP_TICK = 100;

type GameLoopEntity = {
  elapsed: number;
  expired: boolean;
  isTurnClockActive: () => boolean;
  onExpire: () => void;
  onFrame: (delta: number, turnTimeRemaining?: number) => void;
  resetKey: number;
  turnDuration: number;
};

type GameLoopEntities = {
  gameLoop: GameLoopEntity;
};

export class GameLoopTimer {
  private currentTime = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private subscribers: ((time: number) => void)[] = [];

  start() {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.currentTime += GAME_LOOP_TICK;
      this.subscribers.forEach((subscriber) => subscriber(this.currentTime));
    }, GAME_LOOP_TICK);
  }

  stop() {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  subscribe(callback: (time: number) => void) {
    if (!this.subscribers.includes(callback)) {
      this.subscribers.push(callback);
    }
  }

  unsubscribe(callback: (time: number) => void) {
    this.subscribers = this.subscribers.filter(
      (subscriber) => subscriber !== callback,
    );
  }
}

export const runGameLoop: GameEngineSystem = (
  entities: GameLoopEntities,
  { time }: GameEngineUpdateEventOptionType,
) => {
  const loop = entities.gameLoop;

  if (!loop) {
    return entities;
  }

  const delta = Math.max(0, time.delta || GAME_LOOP_TICK);
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
