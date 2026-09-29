let seedCounter = 0;

export function generateRandomSeed() {
  let seed = "";

  // Keep the reserved test prefix exclusive to user-entered test seeds.
  while (seed.slice(0, 4).toLowerCase() === "test" || !seed) {
    seedCounter += 1;
    seed = [
      Date.now().toString(36),
      seedCounter.toString(36),
      Math.random().toString(36).slice(2, 8),
    ].join("-");
  }

  return seed;
}

export function isTestSeed(seed: string) {
  return seed.slice(0, 4).toLowerCase() === "test";
}
