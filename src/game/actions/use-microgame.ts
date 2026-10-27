import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { createNumberStore } from "@/game/state/numberStore";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import type { Difficulty } from "@/utils/settings-storage";

export type MicrogameKind = "concentration" | "timed-attack" | "multitap" | "defense";
export type MultitapTargetSpot = { x: number; y: number };
export type MicrogameOptions = { difficulty?: Difficulty; level?: number };
export type MicrogameResult = { score: number; damageScore: number };
export const HUMAN_REACTION_WINDOW_MS = 250;
export const MICROGAME_MAX_DURATION_MS = 1500;
export const CONCENTRATION_TARGET_DURATION_MS = MICROGAME_MAX_DURATION_MS;
export const TIMED_ATTACK_CUE_DELAY_MS = 1000;
export const TIMED_ATTACK_WINDOW_MS = TIMED_ATTACK_CUE_DELAY_MS + HUMAN_REACTION_WINDOW_MS + 500;
export const MULTITAP_WINDOW_MS = 3000;
export const DEFENSE_CUE_DELAY_MS = 120;
export const DEFENSE_WINDOW_MS = 700;
export const MULTITAP_DOT_DIAMETER = 44;
const now = () => globalThis.performance?.now?.() ?? Date.now();
const scoreWithinRange = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
const normalizeScore = (score: number, kind: MicrogameKind) => kind === "multitap"
  ? Math.max(0, Math.round(score))
  : scoreWithinRange(score);

export function getConcentrationScore(actualMs: number, targetMs: number) {
  // Score falls linearly with timing error and is clamped to the shared 0–100 range.
  return scoreWithinRange(100 - Math.abs(actualMs - targetMs) * 100 / 500);
}

export function getTimedAttackScore(actualMs: number) {
  // Score is measured from the visible cue; a 250 ms human reaction is the perfect response.
  return scoreWithinRange(100 - Math.abs(actualMs - HUMAN_REACTION_WINDOW_MS) * 100 / 500);
}

export function getMultitapTargetTaps(difficulty: Difficulty, level: number) {
  const levelSteps = Math.floor(Math.max(0, level - 1) / GAME_PARAMETERS.microgame.multitapTapsPerLevel);
  return GAME_PARAMETERS.microgame.multitapBaseTaps +
    GAME_PARAMETERS.microgame.multitapDifficultyBonus[difficulty] + levelSteps;
}

export function getMultitapScore(clicks: number, targetTaps: number) {
  return Math.max(0, Math.round(clicks * 100 / Math.max(1, targetTaps)));
}

export function getMultitapGrid(trackWidth: number, trackHeight: number, requestedDiameter: number) {
  const diameter = Math.max(1, Math.min(requestedDiameter, trackWidth * 0.16, trackHeight / 2));
  return {
    diameter,
    columns: Math.max(1, Math.floor((trackWidth / 2) / diameter)),
    rows: Math.max(2, Math.floor(trackHeight / diameter)),
  };
}

export function getNextMultitapTargetSpot(currentSpot: MultitapTargetSpot, handedness: "left" | "right", trackWidth: number, trackHeight: number, dotDiameter: number, random = Math.random): MultitapTargetSpot {
  if (trackWidth <= 0 || trackHeight <= 0) return currentSpot;
  const { diameter, columns, rows } = getMultitapGrid(trackWidth, trackHeight, dotDiameter);
  const cellWidth = (trackWidth / 2) / columns;
  const cellCount = columns * rows;

  const previousColumn = Math.floor((handedness === "left" ? currentSpot.x : currentSpot.x - 0.5) * trackWidth / cellWidth);
  const previousRow = Math.floor(currentSpot.y * rows);
  const previousIndex = previousRow * columns + previousColumn;
  const availableSpots: Array<{ x: number; y: number; index: number }> = [];
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
  const [targetSpot, setTargetSpot] = useState(0.76);
  const [multitapTargetSpot, setMultitapTargetSpot] = useState<MultitapTargetSpot>({ x: 0.76, y: 0.5 });
  const startedAt = useRef(0);
  const leftHandedRef = useRef(false);
  const nowRef = useRef(now);
  const completed = useRef(false);
  const clickCount = useRef(0);
  const onCompleteRef = useRef(onComplete);
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const finish = useCallback((score: number, gameKind = kind) => {
    // A single completion guard prevents tap/timeout races from submitting twice.
    if (completed.current) return;
    completed.current = true;
    setActive(false);
    const normalized = normalizeScore(score, gameKind);
    onCompleteRef.current({ score: Math.min(100, normalized), damageScore: normalized });
  }, [kind]);
  const finishMultitap = useCallback(() => {
    // Keep the bonus damage score uncapped while reporting a conventional average.
    if (completed.current) return;
    completed.current = true;
    setActive(false);
    const damageScore = getMultitapScore(clickCount.current, targetTaps);
    onCompleteRef.current({ score: Math.min(100, damageScore), damageScore });
  }, [targetTaps]);
  const start = useCallback(
    (gameKind: MicrogameKind = "concentration", handedness: "left" | "right" = "right", options?: MicrogameOptions) => {
      completed.current = false;
      setKind(gameKind);
      elapsedStore.setSnapshot(0);
      clickCount.current = 0;
      setTargetDelay(gameKind === "timed-attack" ? TIMED_ATTACK_CUE_DELAY_MS : gameKind === "defense" ? DEFENSE_CUE_DELAY_MS : 200 + Math.floor(Math.random() * 401));
      setTargetTaps(getMultitapTargetTaps(options?.difficulty ?? "normal", options?.level ?? 1));
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
      ? getConcentrationScore(elapsedMs, targetProgress * CONCENTRATION_TARGET_DURATION_MS)
      : kind === "defense" && elapsedMs < targetDelay
        ? 0
        : getTimedAttackScore(elapsedMs - targetDelay);
    finish(score);
  }, [active, kind, targetDelay, targetSpot, targetTaps]);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const duration = getMicrogameWindow(kind);
      const value = Math.min(duration, nowRef.current() - startedAt.current);
      elapsedStore.setSnapshot(value);
      if (value >= duration) {
        if (kind === "multitap") finishMultitap();
        else finish(0, kind);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [active, elapsedStore, finish, finishMultitap, kind, targetTaps]);
  return {
    active,
    kind,
    get elapsed() { return elapsedStore.getSnapshot(); },
    elapsedStore,
    targetDelay,
    targetSpot,
    multitapTargetSpot,
    start,
    tap,
  };
}

export function getMicrogameWindow(kind: MicrogameKind) {
  if (kind === "defense") return DEFENSE_WINDOW_MS;
  if (kind === "timed-attack") return TIMED_ATTACK_WINDOW_MS;
  if (kind === "multitap") return MULTITAP_WINDOW_MS;
  return MICROGAME_MAX_DURATION_MS;
}
