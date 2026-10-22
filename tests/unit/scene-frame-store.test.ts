import { createSceneFrameStore } from "@/game/state/sceneFrameStore";

test("scene frame updates notify only subscribers for changed animation layers", () => {
  const store = createSceneFrameStore();
  const roomSubscriber = jest.fn();
  const enemySubscriber = jest.fn();
  const playerSubscriber = jest.fn();
  store.subscribe(roomSubscriber);
  store.subscribeKeys(["enemyAttackElapsed", "enemyDamageElapsed"], enemySubscriber);
  store.subscribeKeys(["playerAttackElapsed", "playerDamageElapsed"], playerSubscriber);

  store.setFrame(frame => ({ ...frame, playerAttackElapsed: 0 }));

  expect(roomSubscriber).toHaveBeenCalledTimes(1);
  expect(playerSubscriber).toHaveBeenCalledTimes(1);
  expect(enemySubscriber).not.toHaveBeenCalled();

  store.setFrame(frame => ({ ...frame, enemyAttackElapsed: 16 }));

  expect(roomSubscriber).toHaveBeenCalledTimes(2);
  expect(playerSubscriber).toHaveBeenCalledTimes(1);
  expect(enemySubscriber).toHaveBeenCalledTimes(1);
});
