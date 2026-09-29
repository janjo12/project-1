import { createCombatAnimationFrame, type CombatAnimationFrame } from "@/game/entities";

/** Only the scene subscribes to visual ticks; gameplay screens update on game events. */
export function createSceneFrameStore() {
  // Isolate high-frequency scene animation updates from the lower-frequency gameplay state.
  let frame = createCombatAnimationFrame();
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => frame,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setFrame: (update: CombatAnimationFrame | ((previous: CombatAnimationFrame) => CombatAnimationFrame)) => {
      frame = typeof update === "function" ? update(frame) : update;
      listeners.forEach(listener => listener());
    },
  };
}
export type SceneFrameStore = ReturnType<typeof createSceneFrameStore>;
