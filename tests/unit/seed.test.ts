import { generateRandomSeedFrom, isTestSeed } from "@/utils/seed";

test.each([
  ["test", true],
  ["testwarrior", true],
  ["TEST-run", true],
  ["testing", true],
  ["tes", false],
  ["not-test", false],
])("isTestSeed(%s) returns %s", (seed, expected) => {
  expect(isTestSeed(seed)).toBe(expected);
});

test("generated seeds retry if the timestamp collides with the reserved test prefix", () => {
  const timestamps = [parseInt("test", 36), 123456];
  const counters = [1, 2];
  let randomCalls = 0;
  const seed = generateRandomSeedFrom({
    now: () => timestamps.shift()!,
    nextCounter: () => counters.shift()!,
    random: () => { randomCalls += 1; return 0.5; },
  });
  expect(seed).toMatch(/^2n9c-/);
  expect(randomCalls).toBe(2);
});
