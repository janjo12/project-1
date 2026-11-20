export type TutorialHintsState = {
  startingLevelTransitions: number;
  moveHintDismissed: boolean;
  attackPending: boolean;
  getPending: boolean;
  attackedInCurrentRoom: boolean;
  gotSomethingInCurrentRoom: boolean;
};

export const CURRENT_ROOM_HINT_TRANSITION_LIMIT = 3;

export function createTutorialHintsState(): TutorialHintsState {
  return {
    startingLevelTransitions: 0,
    moveHintDismissed: false,
    attackPending: true,
    getPending: true,
    attackedInCurrentRoom: false,
    gotSomethingInCurrentRoom: false,
  };
}

export function shouldShowCurrentRoomHint(level: number, state: TutorialHintsState) {
  return level === 1 && state.startingLevelTransitions < CURRENT_ROOM_HINT_TRANSITION_LIMIT;
}

export function markTutorialAttack(state: TutorialHintsState): TutorialHintsState {
  return { ...state, attackedInCurrentRoom: true };
}

export function markTutorialPickup(state: TutorialHintsState): TutorialHintsState {
  return { ...state, gotSomethingInCurrentRoom: true };
}

export function leaveTutorialRoom(
  state: TutorialHintsState,
  { fromRoomId, startingRoomId, level }: {
    fromRoomId: string;
    startingRoomId: string;
    level: number;
  },
): TutorialHintsState {
  return {
    ...state,
    startingLevelTransitions: state.startingLevelTransitions + (level === 1 ? 1 : 0),
    moveHintDismissed: state.moveHintDismissed || fromRoomId === startingRoomId,
    attackPending: state.attackPending && !state.attackedInCurrentRoom,
    getPending: state.getPending && !state.gotSomethingInCurrentRoom,
    attackedInCurrentRoom: false,
    gotSomethingInCurrentRoom: false,
  };
}
