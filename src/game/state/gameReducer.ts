import type { GameState } from "@/game/state/types";

export type GameStateAction = {
  [Field in keyof GameState]: {
    type: "SET_FIELD";
    field: Field;
    value: GameState[Field];
  };
}[keyof GameState];

export function gameReducer(state: GameState, action: GameStateAction): GameState {
  // Keep updates immutable so React sees each field change without replacing unrelated run state.
  return { ...state, [action.field]: action.value } as GameState;
}
