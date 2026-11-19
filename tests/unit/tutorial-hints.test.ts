import {
  createTutorialHintsState,
  leaveTutorialRoom,
  markTutorialAttack,
  markTutorialPickup,
  shouldShowCurrentRoomHint,
} from "@/game/engine/tutorial-hints";

const leave = (state: ReturnType<typeof createTutorialHintsState>, fromRoomId: string, level = 1) =>
  leaveTutorialRoom(state, { fromRoomId, startingRoomId: "A1", level });

test("Move hint stays dismissed after leaving and returning to the starting room", () => {
  const firstLeave = leave(createTutorialHintsState(), "A1");
  const returnToStart = leave(firstLeave, "A2");

  expect(firstLeave.moveHintDismissed).toBe(true);
  expect(returnToStart.moveHintDismissed).toBe(true);
});

test("Attack hint remains in a room after attacking and clears only after leaving", () => {
  const afterAttack = markTutorialAttack(createTutorialHintsState());
  expect(afterAttack.attackPending).toBe(true);

  const afterLeaving = leave(afterAttack, "A2");
  expect(afterLeaving.attackPending).toBe(false);
  expect(afterLeaving.getPending).toBe(true);
});

test("Get hint remains in a room after pickup and clears only after leaving", () => {
  const afterPickup = markTutorialPickup(createTutorialHintsState());
  expect(afterPickup.getPending).toBe(true);

  const afterLeaving = leave(afterPickup, "A2");
  expect(afterLeaving.getPending).toBe(false);
  expect(afterLeaving.attackPending).toBe(true);
});

test("unfinished Attack and Get hints follow the player into later rooms and levels", () => {
  const afterLeavingWithoutActions = leave(createTutorialHintsState(), "A2");
  const afterEnteringLevelTwo = leave(afterLeavingWithoutActions, "B1", 2);

  expect(afterEnteringLevelTwo.attackPending).toBe(true);
  expect(afterEnteringLevelTwo.getPending).toBe(true);
});

test("You Are Here follows the player for the first three starting-level transitions, then disappears", () => {
  let state = createTutorialHintsState();
  expect(shouldShowCurrentRoomHint(1, state)).toBe(true);

  for (const fromRoomId of ["A1", "A2"]) {
    state = leave(state, fromRoomId);
    expect(shouldShowCurrentRoomHint(1, state)).toBe(true);
  }

  state = leave(state, "A1");
  expect(state.startingLevelTransitions).toBe(3);
  expect(shouldShowCurrentRoomHint(1, state)).toBe(false);
  expect(shouldShowCurrentRoomHint(2, state)).toBe(false);
});
