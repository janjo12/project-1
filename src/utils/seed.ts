let seedCounter = 0;

export function generateRandomSeed() {
  seedCounter += 1;

  return [
    Date.now().toString(36),
    seedCounter.toString(36),
    Math.random().toString(36).slice(2, 8),
  ].join("-");
}
