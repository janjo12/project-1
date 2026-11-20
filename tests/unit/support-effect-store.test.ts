import { createSupportEffectStore } from "@/game/state/supportEffectStore";

test("support feedback only notifies the selected multiplayer actor", () => {
  const store = createSupportEffectStore();
  const allyListener = jest.fn();
  const unrelatedListener = jest.fn();
  const selfListener = jest.fn();
  store.subscribe("ally", allyListener);
  store.subscribe("other-ally", unrelatedListener);
  store.subscribe(null, selfListener);

  store.trigger({ targetId: "ally", emoji: "🛡️", label: "Vanguard" });

  expect(allyListener).toHaveBeenCalledTimes(1);
  expect(unrelatedListener).not.toHaveBeenCalled();
  expect(selfListener).not.toHaveBeenCalled();
  expect(store.getSnapshot("ally")).toMatchObject({ targetId: "ally", label: "Vanguard" });
  expect(store.getSnapshot("other-ally")).toBeNull();
});
