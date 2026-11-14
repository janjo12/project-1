let seedCounter = 0;

export function generateRandomSeed() {
  return generateRandomSeedFrom({ now: Date.now, random: Math.random, nextCounter: () => ++seedCounter });
}

export function generateRandomSeedFrom({ now, random, nextCounter }: {
  now: () => number;
  random: () => number;
  nextCounter: () => number;
}) {
  let seed = "";

  // Keep the reserved test prefix exclusive to user-entered test seeds.
  while (seed.slice(0, 4).toLowerCase() === "test" || !seed) {
    const counter = nextCounter();
    seed = [
      now().toString(36),
      counter.toString(36),
      random().toString(36).slice(2, 8),
    ].join("-");
  }

  return seed;
}

export function isTestSeed(seed: string) {
  return seed.slice(0, 4).toLowerCase() === "test";
}
