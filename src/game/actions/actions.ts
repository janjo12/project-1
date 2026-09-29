import type { Direction } from "@/game/dungeon/types";

export type GameAction =
  | { type: "MOVE"; direction: Direction }
  | { type: "ATTACK"; monsterId: string }
  | { type: "DEFEND" }
  | { type: "PICKUP" }
  | { type: "DESCEND" }
  | { type: "CHARGE" };

export const gameActions = {
  move: (direction: Direction): GameAction => ({ type: "MOVE", direction }),
  attack: (monsterId: string): GameAction => ({ type: "ATTACK", monsterId }),
  defend: (): GameAction => ({ type: "DEFEND" }),
  pickup: (): GameAction => ({ type: "PICKUP" }),
  descend: (): GameAction => ({ type: "DESCEND" }),
  charge: (): GameAction => ({ type: "CHARGE" }),
} as const;
