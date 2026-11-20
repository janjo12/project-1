import type { SupportEffect } from "@/components/Dungeon/Room";

export type SupportEffectStore = {
  getSnapshot: (targetId: string | null) => SupportEffect | null;
  subscribe: (targetId: string | null, listener: () => void) => () => void;
  trigger: (effect: Omit<SupportEffect, "key">) => void;
};

export function createSupportEffectStore(): SupportEffectStore {
  let key = 0;
  const effects = new Map<string | null, SupportEffect>();
  const listeners = new Map<string | null, Set<() => void>>();

  return {
    getSnapshot: targetId => effects.get(targetId) ?? null,
    subscribe: (targetId, listener) => {
      let targetListeners = listeners.get(targetId);
      if (!targetListeners) {
        targetListeners = new Set();
        listeners.set(targetId, targetListeners);
      }
      targetListeners.add(listener);
      return () => {
        targetListeners?.delete(listener);
        if (targetListeners?.size === 0) listeners.delete(targetId);
      };
    },
    trigger: next => {
      effects.set(next.targetId, { ...next, key: ++key });
      listeners.get(next.targetId)?.forEach(listener => listener());
    },
  };
}
