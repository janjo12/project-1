import { CONCENTRATION_TARGET_DURATION_MS, DEFENSE_TARGET_INNER_DIAMETER, DEFENSE_TARGET_OUTER_DIAMETER, DEFENSE_WINDOW_MS, getDefenseRingDiameter, isDefenseRingWithinTargets, getConcentrationScore, getMicrogameWindow, getMultitapGrid, getMultitapScore, getMultitapTargetTaps, getNextMultitapTargetSpot, getTimedAttackScore, MICROGAME_MAX_DURATION_MS, MULTITAP_DOT_DIAMETER, MULTITAP_WINDOW_MS, TIMED_ATTACK_CUE_DELAY_MS, TIMED_ATTACK_WINDOW_MS, getMultiswipeScore, getNextMultiswipeTarget, getMultiswipeStrokeProgress, isMultiswipeEndpoint, MULTISWIPE_WINDOW_MS, getMultiswipeTargetBars, getMultiswipeGrid, getVariedTargetTiming, TARGET_TIMING_VARIANCE_MS } from "@/game/actions/use-microgame";
import { getGameClass } from "@/game/config/game-classes";

test("microgames fit within a 1.5 second window and concentration targets the visible alignment", () => {
  expect(MICROGAME_MAX_DURATION_MS).toBe(1500);
  expect(CONCENTRATION_TARGET_DURATION_MS).toBe(MICROGAME_MAX_DURATION_MS);
  expect(TIMED_ATTACK_WINDOW_MS - TIMED_ATTACK_CUE_DELAY_MS).toBeGreaterThanOrEqual(500);
  expect(getMicrogameWindow("multitap")).toBe(MULTITAP_WINDOW_MS);
  expect(getMicrogameWindow("multiswipe")).toBe(MULTISWIPE_WINDOW_MS);
  expect(MULTITAP_WINDOW_MS).toBe(2000);
  expect(MULTISWIPE_WINDOW_MS).toBe(3000);
  expect(MULTITAP_WINDOW_MS).toBeGreaterThanOrEqual(getMultitapTargetTaps("hard", 10) * 200);
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
  expect(getMultitapScore(targetTaps + 2, targetTaps)).toBeGreaterThan(100);
});

test("Block, Concentration, and Timed Attack timing variance grows by difficulty but stays small", () => {
  for (const base of [600, Math.round(CONCENTRATION_TARGET_DURATION_MS * 0.875), TIMED_ATTACK_CUE_DELAY_MS]) {
    const easyMin = getVariedTargetTiming(base, "easy", () => 0);
    const easyMax = getVariedTargetTiming(base, "easy", () => 0.999);
    const normalMin = getVariedTargetTiming(base, "normal", () => 0);
    const normalMax = getVariedTargetTiming(base, "normal", () => 0.999);
    const hardMin = getVariedTargetTiming(base, "hard", () => 0);
    const hardMax = getVariedTargetTiming(base, "hard", () => 0.999);

    expect(easyMin).toBeGreaterThanOrEqual(base - TARGET_TIMING_VARIANCE_MS.easy);
    expect(easyMax).toBeLessThanOrEqual(base + TARGET_TIMING_VARIANCE_MS.easy);
    expect(normalMin).toBeLessThan(easyMin);
    expect(normalMax).toBeGreaterThan(easyMax);
    expect(hardMin).toBeLessThan(normalMin);
    expect(hardMax).toBeGreaterThan(normalMax);
    expect(hardMax - hardMin).toBeLessThanOrEqual(2 * TARGET_TIMING_VARIANCE_MS.hard);
  }
});

test("Block's ring reaches the target gap at its score time and shrinks to the center by timeout", () => {
  const targetDelay = 600;
  const diameterAtStart = getDefenseRingDiameter(0, targetDelay);
  const diameterAtScoreTime = getDefenseRingDiameter(targetDelay, targetDelay);
  const diameterAtTimeout = getDefenseRingDiameter(DEFENSE_WINDOW_MS, targetDelay);

  expect(diameterAtStart).toBe(136);
  expect(diameterAtScoreTime).toBe((DEFENSE_TARGET_OUTER_DIAMETER + DEFENSE_TARGET_INNER_DIAMETER) / 2);
  expect(isDefenseRingWithinTargets(diameterAtScoreTime)).toBe(true);
  expect(isDefenseRingWithinTargets(diameterAtScoreTime + 5)).toBe(false);
  expect(isDefenseRingWithinTargets(diameterAtScoreTime - 5)).toBe(false);
  expect(diameterAtTimeout).toBe(0);
});

test("Multitap perfect taps scale with difficulty and level", () => {
  expect(getMultitapTargetTaps("easy", 1)).toBe(4);
  expect(getMultitapTargetTaps("normal", 1)).toBe(5);
  expect(getMultitapTargetTaps("hard", 1)).toBe(6);
  expect(getMultitapTargetTaps("hard", 3)).toBeGreaterThan(getMultitapTargetTaps("hard", 1));
});

test("Multitap targets choose a random different cell on a fitting grid and stay on the handedness side", () => {
  for (const [trackWidth, trackHeight] of [[180, 48], [320, 300], [640, 450]]) {
    const { diameter, columns, rows } = getMultitapGrid(trackWidth, trackHeight, MULTITAP_DOT_DIAMETER);
    expect(trackWidth / 2 / columns).toBeGreaterThanOrEqual(diameter);
    expect(trackHeight / rows).toBeGreaterThanOrEqual(diameter);
    for (const handedness of ["left", "right"] as const) {
      let spot = { x: handedness === "left" ? 0.24 : 0.76, y: 0.5 };
      for (const randomValue of [0, 0.2, 0.55, 0.99]) {
        const next = getNextMultitapTargetSpot(spot, handedness, trackWidth, trackHeight, diameter, () => randomValue);
        expect(Math.hypot((next.x - spot.x) * trackWidth, (next.y - spot.y) * trackHeight)).toBeGreaterThanOrEqual(diameter - 0.001);
        expect(handedness === "left" ? next.x : 1 - next.x).toBeLessThan(0.5);
        const currentColumn = Math.floor((handedness === "left" ? spot.x : spot.x - 0.5) * trackWidth / (trackWidth / 2 / columns));
        const currentRow = Math.floor(spot.y * rows);
        const nextColumn = Math.floor((handedness === "left" ? next.x : next.x - 0.5) * trackWidth / (trackWidth / 2 / columns));
        const nextRow = Math.floor(next.y * rows);
        expect(nextRow * columns + nextColumn).not.toBe(currentRow * columns + currentColumn);
      }
    }
  }
});

test("Multitap target selection maps random values to different cells without a fixed sequence", () => {
  const { diameter, columns, rows } = getMultitapGrid(640, 450, MULTITAP_DOT_DIAMETER);
  const spot = { x: 0.76, y: 0.5 };
  const nextCells = [0, 0.5, 0.99].map(value => {
    const next = getNextMultitapTargetSpot(spot, "right", 640, 450, diameter, () => value);
    const column = Math.floor((next.x - 0.5) * 640 / (640 / 2 / columns));
    const row = Math.floor(next.y * rows);
    return row * columns + column;
  });
  expect(new Set(nextCells).size).toBe(3);
});

test("Thief attacks use the Timed Attack microgame", () => {
  expect(getGameClass("thief").microgame).toBe("timed-attack");
});

test("Warrior attacks use Multiswipe and each full swipe is worth three taps", () => {
  expect(getGameClass("warrior").microgame).toBe("multiswipe");
  const tapTarget = getMultitapTargetTaps("normal", 1);
  const barTarget = getMultiswipeTargetBars("normal", 1);
  expect(getMultiswipeScore(barTarget, tapTarget)).toBe(Math.round(barTarget * 300 / tapTarget));
  expect(getMultiswipeScore(barTarget + 1, tapTarget)).toBeGreaterThan(100);
});

test.each([
  ["horizontal", 0],
  ["vertical", 0.5],
  ["diagonal", 0.99],
] as const)("Multiswipe generates one straight %s target without any bends", (expectedAxis, roll) => {
  const width = 640;
  const height = 450;
  const random = jest.fn().mockReturnValueOnce(roll).mockReturnValueOnce(0.37);
  const target = getNextMultiswipeTarget(width, height, MULTITAP_DOT_DIAMETER, random);
  expect(target.axis).toBe(expectedAxis);
  expect("path" in target).toBe(false);
  expect(target.start).not.toEqual(target.end);
  const deltaX = (target.end.x - target.start.x) * width;
  const deltaY = (target.end.y - target.start.y) * height;
  expect(Math.hypot(deltaX, deltaY)).toBeGreaterThan(MULTITAP_DOT_DIAMETER * 2);
  if (target.axis === "diagonal") {
    expect(deltaX).not.toBe(0);
    expect(deltaY).not.toBe(0);
  }
  if (target.axis === "horizontal") expect(deltaY).toBe(0);
  if (target.axis === "vertical") expect(deltaX).toBe(0);
  expect(isMultiswipeEndpoint(target.start, target.start, width, height, MULTITAP_DOT_DIAMETER)).toBe(true);
  expect(isMultiswipeEndpoint(target.end, target.start, width, height, MULTITAP_DOT_DIAMETER)).toBe(false);
});

test("Multiswipe stroke progress follows the straight bar and ignores points away from it", () => {
  const target = {
    start: { x: 0.2, y: 0.2 },
    end: { x: 0.8, y: 0.8 },
    axis: "diagonal" as const,
  };
  expect(getMultiswipeStrokeProgress({ x: 180, y: 55 }, target, 360, 110, 20)).toBeCloseTo(0.5);
  expect(getMultiswipeStrokeProgress({ x: 72, y: 22 }, target, 360, 110, 20)).toBeCloseTo(0);
  expect(getMultiswipeStrokeProgress({ x: 180, y: 5 }, target, 360, 110, 20)).toBeNull();
});
