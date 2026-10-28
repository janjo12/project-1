import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { createNumberStore } from "@/game/state/numberStore";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import type { Difficulty } from "@/utils/settings-storage";

export type MicrogameKind = "concentration" | "timed-attack" | "multitap" | "multiswipe" | "rune-tracer" | "defense";
export type MultitapTargetSpot = { x: number; y: number };
export type MultiswipeTarget = { start: MultitapTargetSpot; end: MultitapTargetSpot; axis: "horizontal" | "vertical" };
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
export const MULTITAP_WINDOW_MS = 3000;
export const MULTISWIPE_WINDOW_MS = MULTITAP_WINDOW_MS;
export const RUNE_TRACER_WINDOW_MS = MULTITAP_WINDOW_MS;
export const DEFENSE_CUE_DELAY_MS = 120;
export const DEFENSE_WINDOW_MS = 700;
export const MULTITAP_DOT_DIAMETER = 44;
const now = () => globalThis.performance?.now?.() ?? Date.now();
const scoreWithinRange = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
const normalizeScore = (score: number, kind: MicrogameKind) => kind === "multitap" || kind === "multiswipe"
  ? Math.max(0, Math.round(score))
  : scoreWithinRange(score);

const focusTolerance = (easeLevel: number) => [1, 1.35, 1.7, 2.2, 2.8][Math.max(0, Math.min(4, Math.floor(easeLevel)))];
const focusScoreFloor = (easeLevel: number) => [0, 12, 24, 38, 52][Math.max(0, Math.min(4, Math.floor(easeLevel)))];

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
  const options: MultiswipeTarget[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      for (const [deltaColumn, deltaRow, axis] of [[3, 0, "horizontal"], [0, 3, "vertical"]] as const) {
        const endColumn = column + deltaColumn;
        const endRow = row + deltaRow;
        if (endColumn >= columns || endRow >= rows) continue;
        const point = (x: number, y: number): MultitapTargetSpot => ({
          x: (x + 0.5) / columns,
          y: (y + 0.5) / rows,
        });
        options.push({ start: point(column, row), end: point(endColumn, endRow), axis });
      }
    }
  }
  if (options.length === 0) return { start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 }, axis: "horizontal" };
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

function distanceToSpot(point: MultitapTargetSpot, spot: MultitapTargetSpot, width: number, height: number) {
  return Math.hypot((point.x - spot.x) * width, (point.y - spot.y) * height);
}

export function isMultiswipeEndpoint(point: MultitapTargetSpot, spot: MultitapTargetSpot, width: number, height: number, diameter: number) {
  return distanceToSpot(point, spot, width, height) <= diameter / 2;
}

export function getMultitapGrid(trackWidth: number, trackHeight: number, requestedDiameter: number) {
  const diameter = Math.max(1, Math.min(requestedDiameter, trackWidth * 0.16, trackHeight / 2));
  return {
    diameter,
    columns: Math.max(1, Math.floor((trackWidth / 2) / diameter)),
    rows: Math.max(2, Math.floor(trackHeight / diameter)),
  };
}

export function getRuneTracerPattern(trackWidth: number, trackHeight: number, handedness: "left" | "right", requestedDiameter = 28): RuneTracerPattern {
  const { diameter, columns, rows } = getMultitapGrid(trackWidth, trackHeight, requestedDiameter);
  const columnOffset = Math.max(0, Math.floor((columns - 4) / 2));
  const rowOffset = Math.max(0, Math.floor((rows - 4) / 2));
  const cellWidth = trackWidth / 2 / columns;
  const cells: Record<string, [number, number]> = {
    A: [1, 0], B: [3, 1], C: [3, 3], D: [0, 3], E: [0, 1], F: [1, 1], G: [1, 2],
  };
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
  const edges: RuneEdge[] = [
    { id: "AB", from: "A", to: "B" }, { id: "BC", from: "B", to: "C" },
    { id: "CD", from: "C", to: "D" }, { id: "DE", from: "D", to: "E" },
    { id: "EA", from: "E", to: "A" }, { id: "AF", from: "A", to: "F" },
    { id: "FG", from: "F", to: "G" }, { id: "GA", from: "G", to: "A" },
  ];
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
  const [kind, setKind] = useState<MicrogameKind>("concentration");
  const [elapsedStore] = useState(() => createNumberStore(0));
  const [targetDelay, setTargetDelay] = useState(500);
  const [targetTaps, setTargetTaps] = useState(() => getMultitapTargetTaps("normal", 1));
  const [easeLevel, setEaseLevel] = useState(0);
  const [targetSpot, setTargetSpot] = useState(0.76);
  const [multitapTargetSpot, setMultitapTargetSpot] = useState<MultitapTargetSpot>({ x: 0.76, y: 0.5 });
  const [multiswipeTarget, setMultiswipeTarget] = useState<MultiswipeTarget>({ start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 }, axis: "horizontal" });
  const startedAt = useRef(0);
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
  const finish = useCallback((score: number, gameKind = kind) => {
    // A single completion guard prevents tap/timeout races from submitting twice.
    if (completed.current) return;
    completed.current = true;
    setActive(false);
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
      setTargetDelay(gameKind === "timed-attack" ? TIMED_ATTACK_CUE_DELAY_MS : gameKind === "defense" ? DEFENSE_CUE_DELAY_MS : 200 + Math.floor(Math.random() * 401));
      setTargetTaps(getFocusedMultitapTargetTaps(options?.difficulty ?? "normal", options?.level ?? 1, nextEaseLevel));
      leftHandedRef.current = handedness === "left";
      const handednessSpot = handedness === "right" ? 0.2 : 0.8;
      setTargetSpot(handednessSpot);
      setMultitapTargetSpot({ x: handedness === "right" ? 0.76 : 0.24, y: 0.5 });
      startedAt.current = nowRef.current();
      setActive(true);
    },
    [elapsedStore],
  );
  const tap = useCallback((trackWidth = 0, dotDiameter = MULTITAP_DOT_DIAMETER, trackHeight = 0) => {
    if (!active || completed.current) return;
    const elapsedMs = nowRef.current() - startedAt.current;
    if (kind === "multitap") {
      const next = clickCount.current + 1;
      clickCount.current = next;
      setMultitapTargetSpot(currentSpot => getNextMultitapTargetSpot(currentSpot, leftHandedRef.current ? "left" : "right", trackWidth, trackHeight, dotDiameter));
      return;
    }
    const targetProgress = leftHandedRef.current ? (targetSpot - 0.1) / 0.8 : (0.9 - targetSpot) / 0.8;
    const score = kind === "concentration"
      ? getConcentrationScore(elapsedMs, targetProgress * CONCENTRATION_TARGET_DURATION_MS, easeLevel)
      : kind === "defense" && elapsedMs < targetDelay
        ? 0
        : getTimedAttackScore(elapsedMs - targetDelay, easeLevel);
    finish(score);
  }, [active, easeLevel, finish, kind, targetDelay, targetSpot]);
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
  }, []);
  const endSwipe = useCallback((x: number, y: number, width: number, height: number, dotDiameter = MULTITAP_DOT_DIAMETER) => {
    if (!active || completed.current || kind !== "multiswipe") return;
    const started = swipeStartedAtEndpoint.current;
    swipeStartedAtEndpoint.current = false;
    if (!started) return;
    const startEndpoint = swipeStartEndpoint.current;
    swipeStartEndpoint.current = null;
    if (width <= 0 || height <= 0) return;
    const point = { x: x / width, y: y / height };
    const reachedOtherEnd = startEndpoint === "start"
      ? isMultiswipeEndpoint(point, multiswipeTarget.end, width, height, dotDiameter)
      : startEndpoint === "end" && isMultiswipeEndpoint(point, multiswipeTarget.start, width, height, dotDiameter);
    const completedBar = reachedOtherEnd;
    if (!completedBar) return;
    swipeCount.current += 1;
    setMultiswipeTarget(getNextMultiswipeTarget(width, height, dotDiameter));
  }, [active, kind, multiswipeTarget]);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
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
    kind,
    get elapsed() { return elapsedStore.getSnapshot(); },
    elapsedStore,
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
