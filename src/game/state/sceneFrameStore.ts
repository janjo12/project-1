import { createCombatAnimationFrame, type CombatAnimationFrame } from "@/game/entities";

/** Share animation time while notifying only the visual layers whose values changed. */
export function createSceneFrameStore() {
  let frame = createCombatAnimationFrame();
  type AnimationKey = keyof CombatAnimationFrame;
  const listeners = new Set<{ listener: () => void; keys: Set<AnimationKey> | null }>();
  return {
    getSnapshot: () => frame,
    subscribe: (listener: () => void) => {
      const subscription = { listener, keys: null };
      listeners.add(subscription);
      return () => { listeners.delete(subscription); };
    },
    subscribeKeys: (keys: readonly AnimationKey[], listener: () => void) => {
      const subscription = { listener, keys: new Set(keys) };
      listeners.add(subscription);
      return () => { listeners.delete(subscription); };
    },
    setFrame: (update: CombatAnimationFrame | ((previous: CombatAnimationFrame) => CombatAnimationFrame)) => {
      const previousFrame = frame;
      const nextFrame = typeof update === "function" ? update(previousFrame) : update;
      if (nextFrame === frame) return;
      frame = nextFrame;
      const changedKeys = (Object.keys(nextFrame) as AnimationKey[])
        .filter(key => nextFrame[key] !== previousFrame[key]);
      if (changedKeys.length === 0) return;
      listeners.forEach(({ listener, keys }) => {
        if (keys === null || changedKeys.some(key => keys.has(key))) listener();
      });
    },
  };
}
export type SceneFrameStore = ReturnType<typeof createSceneFrameStore>;
