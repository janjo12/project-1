import {
  createTutorialHintsState,
  leaveTutorialRoom,
  markTutorialAttack,
  markTutorialPickup,
} from "@/game/engine/tutorial-hints";

const leave = (state: ReturnType<typeof createTutorialHintsState>, fromRoomId: string, nextRoomId: string, level = 1) =>
  leaveTutorialRoom(state, { fromRoomId, startingRoomId: "A1", nextRoomId, level });

test("Move hint stays dismissed after leaving and returning to the starting room", () => {
  const firstLeave = leave(createTutorialHintsState(), "A1", "A2");
  const returnToStart = leave(firstLeave, "A2", "A1");

  expect(firstLeave.moveHintDismissed).toBe(true);
  expect(returnToStart.moveHintDismissed).toBe(true);
});

test("Attack hint remains in a room after attacking and clears only after leaving", () => {
  const afterAttack = markTutorialAttack(createTutorialHintsState());
  expect(afterAttack.attackPending).toBe(true);

  const afterLeaving = leave(afterAttack, "A2", "A3");
  expect(afterLeaving.attackPending).toBe(false);
  expect(afterLeaving.getPending).toBe(true);
});

test("Get hint remains in a room after pickup and clears only after leaving", () => {
  const afterPickup = markTutorialPickup(createTutorialHintsState());
  expect(afterPickup.getPending).toBe(true);

  const afterLeaving = leave(afterPickup, "A2", "A3");
  expect(afterLeaving.getPending).toBe(false);
  expect(afterLeaving.attackPending).toBe(true);
});

test("unfinished Attack and Get hints follow the player into later rooms and levels", () => {
  const afterLeavingWithoutActions = leave(createTutorialHintsState(), "A2", "A3");
  const afterEnteringLevelTwo = leave(afterLeavingWithoutActions, "B1", "B2", 2);

  expect(afterEnteringLevelTwo.attackPending).toBe(true);
  expect(afterEnteringLevelTwo.getPending).toBe(true);
});
