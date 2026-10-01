export type NumberStore = {
  getSnapshot: () => number;
  setSnapshot: (value: number) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createNumberStore(initialValue: number): NumberStore {
  let value = initialValue;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => value,
    setSnapshot: nextValue => {
      if (value === nextValue) return;
      value = nextValue;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
