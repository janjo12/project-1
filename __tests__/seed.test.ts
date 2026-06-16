import { generateRandomSeed } from "@/utils/seed";

describe("seed generation", () => {
  let dateNowSpy: jest.SpyInstance<number, []>;
  let randomSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(123456789);
    randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.123456789);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it("generates a new seed every time even when randomness is repeated", () => {
    expect(generateRandomSeed()).not.toBe(generateRandomSeed());
  });
});
