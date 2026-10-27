import { CONCENTRATION_TARGET_DURATION_MS, getConcentrationScore, getMicrogameWindow, getMultitapGrid, getMultitapScore, getMultitapTargetTaps, getNextMultitapTargetSpot, getTimedAttackScore, HUMAN_REACTION_WINDOW_MS, MICROGAME_MAX_DURATION_MS, MULTITAP_DOT_DIAMETER, MULTITAP_WINDOW_MS, TIMED_ATTACK_CUE_DELAY_MS, TIMED_ATTACK_WINDOW_MS } from "@/game/actions/use-microgame";
import { getGameClass } from "@/game/config/game-classes";

test("microgames fit within a 1.5 second window and concentration targets the visible alignment", () => {
  expect(MICROGAME_MAX_DURATION_MS).toBe(1500);
  expect(CONCENTRATION_TARGET_DURATION_MS).toBe(MICROGAME_MAX_DURATION_MS);
  expect(TIMED_ATTACK_WINDOW_MS - TIMED_ATTACK_CUE_DELAY_MS).toBeGreaterThanOrEqual(500);
  expect(getMicrogameWindow("multitap")).toBe(MULTITAP_WINDOW_MS);
  expect(MULTITAP_WINDOW_MS).toBe(3000);
  expect(MULTITAP_WINDOW_MS).toBeGreaterThanOrEqual(getMultitapTargetTaps("hard", 10) * HUMAN_REACTION_WINDOW_MS);
});

test("microgame modes use their own score rules", () => {
  expect(getConcentrationScore(400, 400)).toBe(100);
  expect(getConcentrationScore(650, 400)).toBe(50);
  expect(getConcentrationScore(650, 400)).toBe(50);
  expect(getTimedAttackScore(250)).toBe(100);
  expect(getTimedAttackScore(0)).toBe(50);
  const targetTaps = getMultitapTargetTaps("hard", 1);
  expect(getMultitapScore(0, targetTaps)).toBe(0);
  expect(getMultitapScore(targetTaps - 2, targetTaps)).toBeCloseTo(67, 0);
  expect(getMultitapScore(targetTaps - 1, targetTaps)).toBeCloseTo(83, 0);
  expect(getMultitapScore(targetTaps, targetTaps)).toBe(100);
});

test("Multitap perfect taps scale with difficulty and level", () => {
  expect(getMultitapTargetTaps("easy", 1)).toBe(4);
  expect(getMultitapTargetTaps("normal", 1)).toBe(5);
  expect(getMultitapTargetTaps("hard", 1)).toBe(6);
  expect(getMultitapTargetTaps("hard", 3)).toBeGreaterThan(getMultitapTargetTaps("hard", 1));
});

test("Multitap targets move on a fitting grid, stay on the handedness side, and never overlap", () => {
  for (const [trackWidth, trackHeight] of [[180, 48], [320, 300], [640, 450]]) {
    const { diameter, columns, rows } = getMultitapGrid(trackWidth, trackHeight, MULTITAP_DOT_DIAMETER);
    expect(trackWidth / 2 / columns).toBeGreaterThanOrEqual(diameter);
    expect(trackHeight / rows).toBeGreaterThanOrEqual(diameter);
    for (const handedness of ["left", "right"] as const) {
      let spot = { x: handedness === "left" ? 0.24 : 0.76, y: 0.5 };
      let changedRows = false;
      for (let tap = 1; tap <= 8; tap += 1) {
        const next = getNextMultitapTargetSpot(spot, handedness, trackWidth, trackHeight, diameter, tap);
        expect(Math.hypot((next.x - spot.x) * trackWidth, (next.y - spot.y) * trackHeight)).toBeGreaterThanOrEqual(diameter - 0.001);
        expect(handedness === "left" ? next.x : 1 - next.x).toBeLessThan(0.5);
        changedRows ||= next.y !== spot.y;
        spot = next;
      }
      expect(changedRows).toBe(true);
    }
  }
});

test("Thief attacks use the Timed Attack microgame", () => {
  expect(getGameClass("thief").microgame).toBe("timed-attack");
});
