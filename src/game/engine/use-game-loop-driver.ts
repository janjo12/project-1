import { useEffect, useRef } from "react";

import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { runGameLoop } from "@/game/engine/run-game-loop";

type GameLoopDriverOptions = {
  enabled: boolean;
  isTurnClockActive: () => boolean;
  onExpire: () => void;
  onFrame: (delta: number, turnTimeRemaining?: number) => void;
  levelNumber: number;
  turnDuration: number;
  turnNumber: number;
};

export function useGameLoopDriver(options: GameLoopDriverOptions) {
  const optionsRef = useRef(options);
  const loopRef = useRef({
    elapsed: 0,
    expired: false,
    levelNumber: options.levelNumber,
    turnDuration: options.turnDuration,
    turnNumber: options.turnNumber,
  });

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const current = loopRef.current;
    if (current.turnNumber !== options.turnNumber || current.levelNumber !== options.levelNumber) {
      loopRef.current = {
        elapsed: 0,
        expired: false,
        levelNumber: options.levelNumber,
        turnDuration: options.turnDuration,
        turnNumber: options.turnNumber,
      };
    }
  }, [options.turnNumber, options.levelNumber]);

  useEffect(() => {
    if (!options.enabled) return;

    const tickMs = GAME_PARAMETERS.turn.gameLoopTickMs;
    let currentTime = 0;
    const timer = setInterval(() => {
      const latest = optionsRef.current;
      const current = loopRef.current;
      if (current.turnNumber !== latest.turnNumber || current.levelNumber !== latest.levelNumber) {
        loopRef.current = {
          elapsed: 0,
          expired: false,
          levelNumber: latest.levelNumber,
          turnDuration: latest.turnDuration,
          turnNumber: latest.turnNumber,
        };
      }
      const loop = {
        ...loopRef.current,
        isTurnClockActive: latest.isTurnClockActive,
        onExpire: latest.onExpire,
        onFrame: latest.onFrame,
        turnDuration: latest.turnDuration,
      };
      currentTime += tickMs;
      runGameLoop(
        { gameLoop: loop },
        { time: { delta: tickMs, currentTime, previousTime: currentTime - tickMs, previousDelta: tickMs } } as never,
      );
      loopRef.current = {
        elapsed: loop.elapsed,
        expired: loop.expired,
        levelNumber: latest.levelNumber,
        turnDuration: latest.turnDuration,
        turnNumber: latest.turnNumber,
      };
    }, tickMs);

    return () => clearInterval(timer);
  }, [options.enabled]);
}
