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

test("generated seeds retry if the timestamp collides with the reserved test prefix", () => {
  const now = jest.spyOn(Date, "now")
    .mockReturnValueOnce(parseInt("test", 36))
    .mockReturnValue(123456);
  const random = jest.spyOn(Math, "random").mockReturnValue(0.5);

  try {
    expect(generateRandomSeed()).toMatch(/^2n9c-/);
    expect(now).toHaveBeenCalledTimes(2);
    expect(random).toHaveBeenCalledTimes(2);
  } finally {
    now.mockRestore();
    random.mockRestore();
  }
});
