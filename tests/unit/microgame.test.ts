import { CONCENTRATION_TARGET_DURATION_MS, getConcentrationScore, getMicrogameWindow, getMultitapScore, getTimedAttackScore, HUMAN_REACTION_WINDOW_MS, MICROGAME_MAX_DURATION_MS, MULTITAP_TARGET_TAPS, MULTITAP_WINDOW_MS, TIMED_ATTACK_CUE_DELAY_MS, TIMED_ATTACK_WINDOW_MS } from "@/game/actions/use-microgame";
import { getGameClass } from "@/game/config/game-classes";

test("microgames fit within a 1.5 second window", () => {
  expect(MICROGAME_MAX_DURATION_MS).toBe(1500);
  expect(MICROGAME_MAX_DURATION_MS - CONCENTRATION_TARGET_DURATION_MS).toBe(250);
  expect(TIMED_ATTACK_WINDOW_MS - TIMED_ATTACK_CUE_DELAY_MS).toBeGreaterThanOrEqual(500);
  expect(getMicrogameWindow("multitap")).toBe(MULTITAP_WINDOW_MS);
  // Keep multitap short; adjust the target tap count so ordinary 250 ms taps can still score well.
  expect(MULTITAP_WINDOW_MS).toBe(3000);
  expect(MULTITAP_TARGET_TAPS).toBe(6);
  expect(MULTITAP_WINDOW_MS).toBeGreaterThanOrEqual(MULTITAP_TARGET_TAPS * HUMAN_REACTION_WINDOW_MS);
});

test("microgame modes use their own score rules", () => {
  expect(getConcentrationScore(400, 400)).toBe(100);
  expect(getConcentrationScore(650, 400)).toBe(50);
  expect(getTimedAttackScore(250)).toBe(100);
  expect(getTimedAttackScore(0)).toBe(50);
  expect(getMultitapScore(0)).toBe(0);
  expect(getMultitapScore(4)).toBeCloseTo(67, 0);
  expect(getMultitapScore(5)).toBeCloseTo(83, 0);
  expect(getMultitapScore(6)).toBe(100);
});

test("Thief attacks use the Timed Attack microgame", () => {
  expect(getGameClass("thief").microgame).toBe("timed-attack");
});
