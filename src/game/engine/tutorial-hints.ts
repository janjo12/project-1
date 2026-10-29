export type TutorialHintsState = {
  moveHintDismissed: boolean;
  attackPending: boolean;
  getPending: boolean;
  attackedInCurrentRoom: boolean;
  gotSomethingInCurrentRoom: boolean;
  visitedRooms: string[];
};

export function createTutorialHintsState(): TutorialHintsState {
  return {
    moveHintDismissed: false,
    attackPending: true,
    getPending: true,
    attackedInCurrentRoom: false,
    gotSomethingInCurrentRoom: false,
    visitedRooms: [],
  };
}

export function markTutorialAttack(state: TutorialHintsState): TutorialHintsState {
  return { ...state, attackedInCurrentRoom: true };
}

export function markTutorialPickup(state: TutorialHintsState): TutorialHintsState {
  return { ...state, gotSomethingInCurrentRoom: true };
}

export function leaveTutorialRoom(
  state: TutorialHintsState,
  { fromRoomId, startingRoomId, nextRoomId, level }: {
    fromRoomId: string;
    startingRoomId: string;
    nextRoomId: string;
    level: number;
  },
): TutorialHintsState {
  const visitedRooms = level === 1 && !state.visitedRooms.includes(nextRoomId)
    ? [...state.visitedRooms, nextRoomId]
    : state.visitedRooms;

  return {
    ...state,
    moveHintDismissed: state.moveHintDismissed || fromRoomId === startingRoomId,
    attackPending: state.attackPending && !state.attackedInCurrentRoom,
    getPending: state.getPending && !state.gotSomethingInCurrentRoom,
    attackedInCurrentRoom: false,
    gotSomethingInCurrentRoom: false,
    visitedRooms,
  };
}
