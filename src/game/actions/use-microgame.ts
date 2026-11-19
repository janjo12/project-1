import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { createNumberStore } from "@/game/state/numberStore";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import type { Difficulty } from "@/utils/settings-storage";

export type MicrogameKind = "concentration" | "timed-attack" | "multitap" | "multiswipe" | "rune-tracer" | "defense";
export type MultitapTargetSpot = { x: number; y: number };
export type MultiswipeTarget = { start: MultitapTargetSpot; end: MultitapTargetSpot; axis: "horizontal" | "vertical" | "diagonal" };
export type RuneNode = { id: string; point: MultitapTargetSpot };
export type RuneEdge = { id: string; from: string; to: string };
export type RuneTracerPattern = { nodes: RuneNode[]; edges: RuneEdge[]; columns: number; rows: number; diameter: number };
export type MicrogameOptions = { difficulty?: Difficulty; level?: number; easeLevel?: number };
export type MicrogameResult = { score: number; damageScore: number };
export const HUMAN_REACTION_WINDOW_MS = 250;
export const MICROGAME_MAX_DURATION_MS = 1500;
export const CONCENTRATION_TARGET_DURATION_MS = MICROGAME_MAX_DURATION_MS;
export const TIMED_ATTACK_CUE_DELAY_MS = 1000;
export const TIMED_ATTACK_WINDOW_MS = TIMED_ATTACK_CUE_DELAY_MS + HUMAN_REACTION_WINDOW_MS + 500;
export const MULTITAP_WINDOW_MS = 2000;
export const MULTISWIPE_WINDOW_MS = 3000;
export const RUNE_TRACER_WINDOW_MS = 3000;
export const DEFENSE_CUE_DELAY_MS = 300;
export const TARGET_TIMING_VARIANCE_MS: Record<Difficulty, number> = { easy: 20, normal: 45, hard: 70 };
export const DEFENSE_WINDOW_MS = 1300;
export const DEFENSE_TARGET_OUTER_DIAMETER = 62;
export const DEFENSE_TARGET_INNER_DIAMETER = 54;
export const MULTITAP_DOT_DIAMETER = 44;
const now = () => globalThis.performance?.now?.() ?? Date.now();
const scoreWithinRange = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
const normalizeScore = (score: number, kind: MicrogameKind) => kind === "multitap" || kind === "multiswipe"
  ? Math.max(0, Math.round(score))
  : scoreWithinRange(score);

const focusTolerance = (easeLevel: number) => [1, 1.35, 1.7, 2.2, 2.8][Math.max(0, Math.min(4, Math.floor(easeLevel)))];
const focusScoreFloor = (easeLevel: number) => [0, 12, 24, 38, 52][Math.max(0, Math.min(4, Math.floor(easeLevel)))];

export function getVariedTargetTiming(baseMs: number, difficulty: Difficulty, random = Math.random) {
  const variance = TARGET_TIMING_VARIANCE_MS[difficulty];
  return Math.round(baseMs + (random() * 2 - 1) * variance);
}

export function getDefenseRingDiameter(elapsed: number, targetDelay: number) {
  const safeDuration = Math.max(1, DEFENSE_WINDOW_MS);
  const safeTarget = Math.max(1, Math.min(safeDuration - 1, targetDelay));
  const safeElapsed = Math.max(0, Math.min(safeDuration, elapsed));
  const targetDiameter = (DEFENSE_TARGET_OUTER_DIAMETER + DEFENSE_TARGET_INNER_DIAMETER) / 2;
  if (safeElapsed <= safeTarget) {
    return 136 - (136 - targetDiameter) * safeElapsed / safeTarget;
  }
  return targetDiameter * (1 - (safeElapsed - safeTarget) / (safeDuration - safeTarget));
}

export function isDefenseRingWithinTargets(diameter: number) {
  // Account for the 3 px moving stroke and 2 px target strokes.
  return diameter >= DEFENSE_TARGET_INNER_DIAMETER + 2 && diameter <= DEFENSE_TARGET_OUTER_DIAMETER - 4;
}

function applyFocusScoreFloor(score: number, easeLevel: number) {
  if (easeLevel <= 0 || score >= 100) return score;
  const floor = focusScoreFloor(easeLevel);
  return Math.round(floor + score * (100 - floor) / 100);
}

export function getConcentrationScore(actualMs: number, targetMs: number, easeLevel = 0) {
  // Score falls linearly with timing error and is clamped to the shared 0–100 range.
  return scoreWithinRange(100 - Math.abs(actualMs - targetMs) * 100 / (500 * focusTolerance(easeLevel)));
}

export function getTimedAttackScore(actualMs: number, easeLevel = 0) {
  // Score is measured from the visible cue; a 250 ms human reaction is the perfect response.
  return scoreWithinRange(100 - Math.abs(actualMs - HUMAN_REACTION_WINDOW_MS) * 100 / (500 * focusTolerance(easeLevel)));
}

export function getMultitapTargetTaps(difficulty: Difficulty, level: number) {
  const levelSteps = Math.floor(Math.max(0, level - 1) / GAME_PARAMETERS.microgame.multitapTapsPerLevel);
  return GAME_PARAMETERS.microgame.multitapBaseTaps +
    GAME_PARAMETERS.microgame.multitapDifficultyBonus[difficulty] + levelSteps;
}

export function getFocusedMultitapTargetTaps(difficulty: Difficulty, level: number, easeLevel: number) {
  return Math.max(1, getMultitapTargetTaps(difficulty, level) - Math.max(0, Math.floor(easeLevel)));
}

export function getMultitapScore(clicks: number, targetTaps: number) {
  return Math.max(0, Math.round(clicks * 100 / Math.max(1, targetTaps)));
}

export function getMultiswipeTargetBars(difficulty: Difficulty, level: number) {
  return Math.max(1, Math.ceil(getMultitapTargetTaps(difficulty, level) / 3));
}

export function getMultiswipeScore(completedSwipes: number, targetBars: number) {
  return getMultitapScore(completedSwipes * 3, targetBars);
}

export function getMultiswipeGrid(trackWidth: number, trackHeight: number, requestedDiameter: number) {
  const diameter = Math.max(1, Math.min(requestedDiameter, trackWidth * 0.16, trackHeight / 2));
  return {
    diameter,
    columns: Math.max(1, Math.floor(trackWidth / diameter)),
    rows: Math.max(2, Math.floor(trackHeight / diameter)),
  };
}

export function getNextMultiswipeTarget(trackWidth: number, trackHeight: number, requestedDiameter: number, random = Math.random): MultiswipeTarget {
  if (trackWidth <= 0 || trackHeight <= 0) {
    return { start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 }, axis: "horizontal" };
  }
  const { columns, rows } = getMultiswipeGrid(trackWidth, trackHeight, requestedDiameter);
  const point = (column: number, row: number): MultitapTargetSpot => ({ x: (column + 0.5) / columns, y: (row + 0.5) / rows });
  const candidates: { start: MultitapTargetSpot; end: MultitapTargetSpot; axis: MultiswipeTarget["axis"] }[] = [];
  for (let startRow = 0; startRow < rows; startRow += 1) {
    for (let startColumn = 0; startColumn < columns; startColumn += 1) {
      for (let endRow = 0; endRow < rows; endRow += 1) {
        for (let endColumn = 0; endColumn < columns; endColumn += 1) {
          const deltaX = endColumn - startColumn;
          const deltaY = endRow - startRow;
          const span = Math.max(Math.abs(deltaX), Math.abs(deltaY));
          if (span < 2 || span > 4) continue;
          candidates.push({
            start: point(startColumn, startRow),
            end: point(endColumn, endRow),
            axis: deltaX === 0 ? "vertical" : deltaY === 0 ? "horizontal" : "diagonal",
          });
        }
      }
    }
  }
  if (candidates.length === 0) return { start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 }, axis: "horizontal" };
  const roll = Math.max(0, Math.min(0.999999, random()));
  const preferredAxis = roll < 1 / 3 ? "horizontal" : roll < 2 / 3 ? "vertical" : "diagonal";
  const directionalCandidates = candidates.filter(candidate => candidate.axis === preferredAxis);
  const options = directionalCandidates.length > 0 ? directionalCandidates : candidates;
  const choice = Math.max(0, Math.min(options.length - 1, Math.floor(random() * options.length)));
  return options[choice];
}

function distanceToSpot(point: MultitapTargetSpot, spot: MultitapTargetSpot, width: number, height: number) {
  return Math.hypot((point.x - spot.x) * width, (point.y - spot.y) * height);
}

export function isMultiswipeEndpoint(point: MultitapTargetSpot, spot: MultitapTargetSpot, width: number, height: number, diameter: number) {
  return distanceToSpot(point, spot, width, height) <= diameter / 2;
}

export function getMultiswipeStrokeProgress(point: MultitapTargetSpot, target: MultiswipeTarget, width: number, height: number, tolerance: number) {
  if (width <= 0 || height <= 0) return null;
  const startX = target.start.x * width;
  const startY = target.start.y * height;
  const deltaX = (target.end.x - target.start.x) * width;
  const deltaY = (target.end.y - target.start.y) * height;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared <= 0) return null;

  const pointX = point.x - startX;
  const pointY = point.y - startY;
  const projectedProgress = (pointX * deltaX + pointY * deltaY) / lengthSquared;
  const progress = Math.max(0, Math.min(1, projectedProgress));
  const nearestX = startX + deltaX * progress;
  const nearestY = startY + deltaY * progress;
  return Math.hypot(point.x - nearestX, point.y - nearestY) <= tolerance ? progress : null;
}

export function getMultitapGrid(trackWidth: number, trackHeight: number, requestedDiameter: number) {
  const diameter = Math.max(1, Math.min(requestedDiameter, trackWidth * 0.16, trackHeight / 2));
  return {
    diameter,
    columns: Math.max(1, Math.floor((trackWidth / 2) / diameter)),
    rows: Math.max(2, Math.floor(trackHeight / diameter)),
  };
}

export function getRuneTracerPattern(trackWidth: number, trackHeight: number, handedness: "left" | "right", requestedDiameter = 28, patternSeed = 1): RuneTracerPattern {
  const { diameter, columns, rows } = getMultitapGrid(trackWidth, trackHeight, requestedDiameter);
  const columnOffset = Math.max(0, Math.floor((columns - 4) / 2));
  const rowOffset = Math.max(0, Math.floor((rows - 4) / 2));
  const cellWidth = trackWidth / 2 / columns;
  // Build a connected rune with a seeded step walk. The seed stays fixed for
  // this overlay instance, so resizing does not change the shape mid-trace.
  let randomState = patternSeed >>> 0 || 1;
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 0x100000000;
  };
  const route: [number, number][] = [[1, 1]];
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const walk = (): boolean => {
    if (route.length === 7) return true;
    const [column, row] = route[route.length - 1];
    const options = steps
      .map(([dx, dy]) => [column + dx, row + dy] as [number, number])
      .filter(([x, y]) => x >= 0 && x < 4 && y >= 0 && y < 4 && !route.some(([rx, ry]) => rx === x && ry === y))
      .sort(() => random() - 0.5);
    for (const next of options) {
      route.push(next);
      if (walk()) return true;
      route.pop();
    }
    return false;
  };
  walk();
  const cells: Record<string, [number, number]> = Object.fromEntries(route.map((point, index) => [String.fromCharCode(65 + index), point]));
  const nodes = Object.entries(cells).map(([id, [column, row]]) => {
    const x = column + columnOffset;
    const y = row + rowOffset;
    return {
      id,
      point: {
        x: (handedness === "left" ? 0 : 0.5) + ((x + 0.5) * cellWidth) / Math.max(1, trackWidth),
        y: (y + 0.5) / Math.max(1, rows),
      },
    };
  });
  const nodeIds = Object.keys(cells);
  const edges: RuneEdge[] = nodeIds.slice(1).map((id, index) => ({ id: `${nodeIds[index]}${id}`, from: nodeIds[index], to: id }));
  return { nodes, edges, columns, rows, diameter };
}

export function getRuneTracerScore(progress: number, elapsedMs: number, completed: boolean, duration = RUNE_TRACER_WINDOW_MS) {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  if (!completed) return Math.round(boundedProgress * 100);
  return Math.round(100 * (1 - Math.max(0, Math.min(duration, elapsedMs)) / duration));
}

export function getNextMultitapTargetSpot(currentSpot: MultitapTargetSpot, handedness: "left" | "right", trackWidth: number, trackHeight: number, dotDiameter: number, random = Math.random): MultitapTargetSpot {
  if (trackWidth <= 0 || trackHeight <= 0) return currentSpot;
  const { diameter, columns, rows } = getMultitapGrid(trackWidth, trackHeight, dotDiameter);
  const cellWidth = (trackWidth / 2) / columns;
  const cellCount = columns * rows;

  const previousColumn = Math.floor((handedness === "left" ? currentSpot.x : currentSpot.x - 0.5) * trackWidth / cellWidth);
  const previousRow = Math.floor(currentSpot.y * rows);
  const previousIndex = previousRow * columns + previousColumn;
  const availableSpots: { x: number; y: number; index: number }[] = [];
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    if (cellIndex === previousIndex) continue;
    const column = cellIndex % columns;
    const row = Math.floor(cellIndex / columns);
    const x = handedness === "left"
      ? ((column + 0.5) * cellWidth) / trackWidth
      : 0.5 + ((column + 0.5) * cellWidth) / trackWidth;
    const y = (row + 0.5) / rows;
    if (Math.hypot((x - currentSpot.x) * trackWidth, (y - currentSpot.y) * trackHeight) >= diameter) {
      availableSpots.push({ x, y, index: cellIndex });
    }
  }
  if (!availableSpots.length) return currentSpot;
  return availableSpots[Math.min(availableSpots.length - 1, Math.floor(random() * availableSpots.length))];
}

export function useMicrogame(onComplete: (result: MicrogameResult) => void) {
  const [active, setActive] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const [kind, setKind] = useState<MicrogameKind>("concentration");
  const [elapsedStore] = useState(() => createNumberStore(0));
  const [targetDelay, setTargetDelay] = useState(500);
  const [targetTaps, setTargetTaps] = useState(() => getMultitapTargetTaps("normal", 1));
  const [easeLevel, setEaseLevel] = useState(0);
  const [targetSpot, setTargetSpot] = useState(0.76);
  const [multitapTargetSpot, setMultitapTargetSpot] = useState<MultitapTargetSpot>({ x: 0.76, y: 0.5 });
  const [multiswipeTarget, setMultiswipeTarget] = useState<MultiswipeTarget>({ start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 }, axis: "horizontal" });
  const [actionProgress, setActionProgress] = useState(0);
  const startedAt = useRef(0);
  const defenseFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leftHandedRef = useRef(false);
  const nowRef = useRef(now);
  const completed = useRef(false);
  const clickCount = useRef(0);
  const swipeCount = useRef(0);
  const swipeStartedAtEndpoint = useRef(false);
  const swipeStartEndpoint = useRef<"start" | "end" | null>(null);
  const runeProgress = useRef(0);
  const onCompleteRef = useRef(onComplete);
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const finish = useCallback((score: number, gameKind = kind, visualHoldMs = 0) => {
    // A single completion guard prevents tap/timeout races from submitting twice.
    if (completed.current) return;
    completed.current = true;
    if (defenseFeedbackTimer.current) clearTimeout(defenseFeedbackTimer.current);
    if (visualHoldMs > 0) {
      defenseFeedbackTimer.current = setTimeout(() => {
        defenseFeedbackTimer.current = null;
        setActive(false);
      }, visualHoldMs);
    } else {
      setActive(false);
    }
    const normalized = applyFocusScoreFloor(normalizeScore(score, gameKind), easeLevel);
    onCompleteRef.current({ score: Math.min(100, normalized), damageScore: normalized });
  }, [easeLevel, kind]);
  const finishMultitap = useCallback(() => {
    // Keep the bonus damage score uncapped while reporting a conventional average.
    if (completed.current) return;
    completed.current = true;
    setActive(false);
    const damageScore = applyFocusScoreFloor(getMultitapScore(clickCount.current, targetTaps), easeLevel);
    onCompleteRef.current({ score: Math.min(100, damageScore), damageScore });
  }, [easeLevel, targetTaps]);
  const finishMultiswipe = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    setActive(false);
    const damageScore = applyFocusScoreFloor(getMultiswipeScore(swipeCount.current, targetTaps), easeLevel);
    onCompleteRef.current({ score: Math.min(100, damageScore), damageScore });
  }, [easeLevel, targetTaps]);
  const finishRuneTracer = useCallback((completedRune: boolean, progress = runeProgress.current) => {
    if (completed.current) return;
    completed.current = true;
    setActive(false);
    const elapsedMs = nowRef.current() - startedAt.current;
    const rawScore = getRuneTracerScore(progress, elapsedMs, completedRune);
    const damageScore = applyFocusScoreFloor(rawScore, easeLevel);
    onCompleteRef.current({ score: Math.min(100, damageScore), damageScore });
  }, [easeLevel]);
  const start = useCallback(
    (gameKind: MicrogameKind = "concentration", handedness: "left" | "right" = "right", options?: MicrogameOptions) => {
      if (defenseFeedbackTimer.current) clearTimeout(defenseFeedbackTimer.current);
      defenseFeedbackTimer.current = null;
      setSessionId(current => current + 1);
      completed.current = false;
      setKind(gameKind);
      const nextEaseLevel = Math.max(0, Math.min(4, Math.floor(options?.easeLevel ?? 0)));
      setEaseLevel(nextEaseLevel);
      elapsedStore.setSnapshot(0);
      clickCount.current = 0;
      swipeCount.current = 0;
      swipeStartedAtEndpoint.current = false;
      swipeStartEndpoint.current = null;
      runeProgress.current = 0;
      setActionProgress(0);
      const difficulty = options?.difficulty ?? "normal";
      const concentrationTargetMs = getVariedTargetTiming(Math.round(CONCENTRATION_TARGET_DURATION_MS * 0.875), difficulty);
      const nextTargetDelay = gameKind === "timed-attack"
        ? getVariedTargetTiming(TIMED_ATTACK_CUE_DELAY_MS, difficulty)
        : gameKind === "defense"
          ? getVariedTargetTiming(600, difficulty)
          : gameKind === "concentration"
            ? concentrationTargetMs
            : 200 + Math.floor(Math.random() * 401);
      setTargetDelay(nextTargetDelay);
      setTargetTaps(getFocusedMultitapTargetTaps(options?.difficulty ?? "normal", options?.level ?? 1, nextEaseLevel));
      leftHandedRef.current = handedness === "left";
      const handednessSpot = gameKind === "concentration"
        ? handedness === "right" ? 0.9 - 0.8 * (concentrationTargetMs / CONCENTRATION_TARGET_DURATION_MS) : 0.1 + 0.8 * (concentrationTargetMs / CONCENTRATION_TARGET_DURATION_MS)
        : handedness === "right" ? 0.2 : 0.8;
      setTargetSpot(handednessSpot);
      setMultitapTargetSpot({ x: handedness === "right" ? 0.76 : 0.24, y: 0.5 });
      startedAt.current = nowRef.current();
      setActive(true);
    },
    [elapsedStore],
  );
  const tap = useCallback((trackWidth = 0, dotDiameter = MULTITAP_DOT_DIAMETER, trackHeight = 0, elapsedOverride?: number) => {
    if (!active || completed.current) return;
    const elapsedMs = elapsedOverride ?? nowRef.current() - startedAt.current;
    if (kind === "multitap") {
      const next = clickCount.current + 1;
      clickCount.current = next;
      setActionProgress(Math.min(1, next / targetTaps));
      setMultitapTargetSpot(currentSpot => getNextMultitapTargetSpot(currentSpot, leftHandedRef.current ? "left" : "right", trackWidth, trackHeight, dotDiameter));
      return;
    }
    const score = kind === "concentration"
      ? getConcentrationScore(elapsedMs, targetDelay, easeLevel)
      : kind === "defense" && elapsedMs < targetDelay
        ? 0
        : kind === "defense"
          ? scoreWithinRange(100 - Math.abs(elapsedMs - targetDelay) * 100 / (500 * focusTolerance(easeLevel)))
        : getTimedAttackScore(elapsedMs - targetDelay, easeLevel);
    finish(score, kind, kind === "defense" ? 180 : 0);
  }, [active, easeLevel, finish, kind, targetDelay, targetTaps]);
  const startSwipe = useCallback((x: number, y: number, width: number, height: number, dotDiameter = MULTITAP_DOT_DIAMETER) => {
    if (!active || completed.current || kind !== "multiswipe") return;
    if (width <= 0 || height <= 0) return;
    const point = { x: x / width, y: y / height };
    if (isMultiswipeEndpoint(point, multiswipeTarget.start, width, height, dotDiameter)) {
      swipeStartedAtEndpoint.current = true;
      swipeStartEndpoint.current = "start";
    } else if (isMultiswipeEndpoint(point, multiswipeTarget.end, width, height, dotDiameter)) {
      swipeStartedAtEndpoint.current = true;
      swipeStartEndpoint.current = "end";
    } else {
      swipeStartedAtEndpoint.current = false;
      swipeStartEndpoint.current = null;
    }
  }, [active, kind, multiswipeTarget]);
  const updateMultiswipeTarget = useCallback((width: number, height: number) => {
    setMultiswipeTarget(getNextMultiswipeTarget(width, height, MULTITAP_DOT_DIAMETER));
  }, []);
  const updateRuneProgress = useCallback((progress: number) => {
    runeProgress.current = Math.max(0, Math.min(1, progress));
    setActionProgress(runeProgress.current);
  }, []);
  const endSwipe = useCallback((x: number, y: number, width: number, height: number, dotDiameter = MULTITAP_DOT_DIAMETER) => {
    if (!active || completed.current || kind !== "multiswipe") return false;
    const started = swipeStartedAtEndpoint.current;
    swipeStartedAtEndpoint.current = false;
    if (!started) return false;
    const startEndpoint = swipeStartEndpoint.current;
    swipeStartEndpoint.current = null;
    if (width <= 0 || height <= 0) return false;
    const point = { x: x / width, y: y / height };
    const reachedOtherEnd = startEndpoint === "start"
      ? isMultiswipeEndpoint(point, multiswipeTarget.end, width, height, dotDiameter)
      : startEndpoint === "end" && isMultiswipeEndpoint(point, multiswipeTarget.start, width, height, dotDiameter);
    const completedBar = reachedOtherEnd;
    if (!completedBar) return false;
    swipeCount.current += 1;
    setActionProgress(Math.min(1, swipeCount.current / Math.max(1, Math.ceil(targetTaps / 3))));
    setMultiswipeTarget(getNextMultiswipeTarget(width, height, dotDiameter));
    return true;
  }, [active, kind, multiswipeTarget, targetTaps]);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      if (completed.current) return;
      const duration = getMicrogameWindow(kind);
      const value = Math.min(duration, nowRef.current() - startedAt.current);
      elapsedStore.setSnapshot(value);
      if (value >= duration) {
        if (kind === "multitap") finishMultitap();
        else if (kind === "multiswipe") finishMultiswipe();
        else if (kind === "rune-tracer") finishRuneTracer(false);
        else finish(0, kind);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [active, elapsedStore, finish, finishMultitap, finishMultiswipe, finishRuneTracer, kind, targetTaps]);
  return {
    active,
    sessionId,
    kind,
    get elapsed() { return elapsedStore.getSnapshot(); },
    elapsedStore,
    actionProgress,
    targetDelay,
    targetSpot,
    multitapTargetSpot,
    multiswipeTarget,
    start,
    tap,
    startSwipe,
    endSwipe,
    updateMultiswipeTarget,
    updateRuneProgress,
    finishRuneTracer,
  };
}

export function getMicrogameWindow(kind: MicrogameKind) {
  if (kind === "defense") return DEFENSE_WINDOW_MS;
  if (kind === "timed-attack") return TIMED_ATTACK_WINDOW_MS;
  if (kind === "multitap") return MULTITAP_WINDOW_MS;
  if (kind === "multiswipe") return MULTISWIPE_WINDOW_MS;
  if (kind === "rune-tracer") return RUNE_TRACER_WINDOW_MS;
  return MICROGAME_MAX_DURATION_MS;
}
