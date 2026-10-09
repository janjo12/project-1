import { CONCENTRATION_TARGET_DURATION_MS, getConcentrationScore, getMicrogameWindow, getMultitapScore, getTimedAttackScore, HUMAN_REACTION_WINDOW_MS, MICROGAME_MAX_DURATION_MS, MULTITAP_WINDOW_MS, TIMED_ATTACK_CUE_DELAY_MS, TIMED_ATTACK_WINDOW_MS } from "@/game/actions/use-microgame";
import { getGameClass } from "@/game/config/game-classes";

test("microgames fit within a 1.5 second window", () => {
  expect(MICROGAME_MAX_DURATION_MS).toBe(1500);
  expect(MICROGAME_MAX_DURATION_MS - CONCENTRATION_TARGET_DURATION_MS).toBe(250);
  expect(TIMED_ATTACK_WINDOW_MS - TIMED_ATTACK_CUE_DELAY_MS).toBeGreaterThanOrEqual(500);
  expect(getMicrogameWindow("multitap")).toBe(MULTITAP_WINDOW_MS);
  // Ten human-paced taps need room for input dispatch and rendering as well as reaction time.
  expect(MULTITAP_WINDOW_MS).toBeGreaterThanOrEqual(10 * (HUMAN_REACTION_WINDOW_MS + 150) + 500);
});

test("microgame modes use their own score rules", () => {
  expect(getConcentrationScore(400, 400)).toBe(100);
  expect(getConcentrationScore(650, 400)).toBe(50);
  expect(getTimedAttackScore(250)).toBe(100);
  expect(getTimedAttackScore(0)).toBe(50);
  expect(getMultitapScore(0)).toBe(0);
  expect(getMultitapScore(7)).toBe(70);
  expect(getMultitapScore(10)).toBe(100);
});

test("Thief attacks use the Timed Attack microgame", () => {
  expect(getGameClass("thief").microgame).toBe("timed-attack");
});
