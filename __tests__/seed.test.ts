import { generateRandomSeed, isTestSeed } from "@/utils/seed";

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

test("generated random seeds never use the reserved test prefix", () => {
  for (let index = 0; index < 100; index += 1) {
    expect(isTestSeed(generateRandomSeed())).toBe(false);
  }
});
