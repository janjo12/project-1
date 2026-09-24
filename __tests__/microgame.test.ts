import { getConcentrationScore, getMultitapScore, getTimedAttackScore, MICROGAME_MAX_DURATION_MS } from "@/hooks/use-microgame";
import { getGameClass } from "@/game-classes";

test("microgames fit within a 1.5 second window", () => {
  expect(MICROGAME_MAX_DURATION_MS).toBe(1500);
});

test("microgame modes use their own score rules", () => {
  expect(getConcentrationScore(400, 400)).toBe(100);
  expect(getConcentrationScore(650, 400)).toBe(50);
  expect(getTimedAttackScore(250)).toBe(100);
  expect(getTimedAttackScore(0)).toBe(25);
  expect(getMultitapScore(0)).toBe(0);
  expect(getMultitapScore(7)).toBe(70);
  expect(getMultitapScore(10)).toBe(100);
});

test("Thief attacks use the Timed Attack microgame", () => {
  expect(getGameClass("thief").microgame).toBe("timed-attack");
});
